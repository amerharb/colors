import './App.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import SettingsPanel from './SettingsPanel'
import { Color, Language } from './colors/Color'
import { isVisible } from './featureFlags'
import {
	Settings,
	SortMode,
	DEFAULT_SETTINGS,
	loadSettings,
	saveSettings,
	applyTheme,
	preferredLanguage,
} from './settingsStore'
import { getAudioBlob, ensureCached, idbCount, idbClear } from './audioCache'
import { black } from './colors/000'
import { blue } from './colors/00f'
import { green } from './colors/0f0'
import { red } from './colors/f00'
import { orange } from './colors/f80'
import { yellow } from './colors/ff0'
import { white } from './colors/fff'

// Fisher–Yates shuffle into a new array (used to scramble the swatch positions on game start)
function shuffle<T>(items: T[]): T[] {
	const out = items.slice()
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[out[i], out[j]] = [out[j], out[i]]
	}
	return out
}

const randomOf = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

// Order the colors for display. 'lang' sorts by the color name in the given
// language (only when one is selected — otherwise falls back to code); 'random' uses
// the frozen randomOrder (unknown codes go last); 'code' (default) sorts by code.
function sortColors(colors: Color[], mode: SortMode, lang: Language, hasLanguage: boolean, randomOrder: string[]): Color[] {
	const list = colors.slice()
	if (mode === 'lang' && hasLanguage) {
		return list.sort((a, b) => a.name[lang].localeCompare(b.name[lang], lang) || a.code.localeCompare(b.code))
	}
	if (mode === 'random') {
		const pos = (code: string) => {
			const i = randomOrder.indexOf(code)
			return i === -1 ? Number.MAX_SAFE_INTEGER : i
		}
		return list.sort((a, b) => pos(a.code) - pos(b.code) || a.code.localeCompare(b.code))
	}
	return list.sort((a, b) => a.code.localeCompare(b.code))
}

// short win/lose feedback sounds
function playFx(name: 'correct' | 'wrong' | 'giveup') {
	try {
		new Audio(`/sound/fx/${name}.aac`).play().catch(() => {})
	} catch {
		// ignore
	}
}

function App() {
	// everything the build supports (after the beta feature flag)
	const ALL_COLORS: Color[] = [black, blue, green, red, orange, yellow, white].filter(isVisible)
	const LANGUAGE_DEFS: { code: Language, display: string, beta?: boolean }[] = [
		{ code: 'en', display: 'English' },
		{ code: 'ar', display: 'عربي' },
		{ code: 'de', display: 'Deutsch' },
		{ code: 'sv', display: 'Svenska' },
	]
	const ALL_LANGUAGES = LANGUAGE_DEFS.filter(isVisible)

	// the sound currently playing, so starting a new one can stop it first
	const playingAudio = useRef<HTMLAudioElement | null>(null)
	// code of the color whose sound is playing, to show the play icon on its button
	const [playingCode, setPlayingCode] = useState<string | null>(null)
	// true while flight-mode downloads are in progress, to show it on the toggle
	const [caching, setCaching] = useState(false)
	// how many sound files are currently in the cache, shown in settings
	const [cachedCount, setCachedCount] = useState(0)

	// 🔇: when muted, nothing plays (prompts, names, or feedback sounds).
	// A ref mirrors the state so the audio helpers and pending prompt timers
	// always see the current value.
	const [muted, setMuted] = useState(false)
	const mutedRef = useRef(false)

	// pending "play the next prompt" timer during the game, so it can be cancelled
	// if the game ends (or is stopped) before it fires — otherwise a late timer
	// would start a sound after the game is already over
	const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const stopSound = useCallback(() => {
		if (promptTimer.current) {
			clearTimeout(promptTimer.current)
			promptTimer.current = null
		}
		if (playingAudio.current) {
			playingAudio.current.pause()
			URL.revokeObjectURL(playingAudio.current.src)
			playingAudio.current = null
		}
		setPlayingCode(null)
	}, [])

	// mute toggle (🔊/🔇): muting also silences whatever is playing right now
	const toggleMute = () => {
		const next = !muted
		mutedRef.current = next
		if (next) stopSound()
		setMuted(next)
	}

	// user settings (theme + which languages/colors to show on the main screen)
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
	useEffect(() => {
		let loaded = loadSettings()

		// URL params override visibility for a shareable/deep-linked view:
		//   ?c=f00,0f0,00f  -> only these colors are visible
		//   ?l=en,ar        -> only these languages are visible; the first is selected
		// Order in the params does not affect the on-screen order.
		const params = new URLSearchParams(window.location.search)

		const cParam = params.get('c')
		if (cParam !== null) {
			const want = new Set(cParam.split(',').map(s => s.trim()).filter(Boolean))
			const hiddenColors = ALL_COLORS.map(c => c.code).filter(c => !want.has(c))
			loaded = { ...loaded, hiddenColors }
		}

		const lParam = params.get('l')
		if (lParam !== null) {
			const valid = new Set(ALL_LANGUAGES.map(l => l.code))
			const want = lParam.split(',').map(s => s.trim()).filter(c => valid.has(c as Language))
			const hiddenLanguages = ALL_LANGUAGES.map(l => l.code).filter(c => !want.includes(c))
			loaded = { ...loaded, hiddenLanguages }
			if (want.length > 0) setLang(want[0] as Language) // first listed = selected
		}

		setSettings(loaded)
		applyTheme(loaded.theme)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// language of the displayed and spoken color name; defaults to the browser's
	// preferred language on first load (the fallback effect below keeps it visible)
	const [lang, setLang] = useState<Language>(() => preferredLanguage())
	const [name, setName] = useState('')

	const refreshCacheCount = useCallback(async () => {
		try {
			setCachedCount(await idbCount())
		} catch {
			// leave the previous count
		}
	}, [])
	useEffect(() => {
		refreshCacheCount()
	}, [refreshCacheCount])

	// delete only the downloaded sound files (settings stay); not allowed in flight mode
	const clearSoundCache = useCallback(async () => {
		try {
			await idbClear()
		} catch {
			// ignore
		}
		setCachedCount(0)
	}, [])

	// Flight mode: download the given sounds into the cache, showing the busy state.
	const cacheAudioUrls = useCallback(async (audioUrls: string[]) => {
		setCaching(true)
		try {
			await ensureCached(audioUrls)
		} finally {
			setCaching(false)
			refreshCacheCount()
		}
	}, [refreshCacheCount])

	const updateSettings = (next: Settings) => {
		// stop playback when its color, or the selected language, just got hidden —
		// otherwise the sound would keep playing with no button left to stop it
		if (
			(playingCode && next.hiddenColors.includes(playingCode)) ||
			next.hiddenLanguages.includes(lang)
		) {
			stopSound()
		}

		// flight mode: download what is (or becomes) visible
		const visibleLangs = ALL_LANGUAGES.filter(l => !next.hiddenLanguages.includes(l.code))
		const visibleColors = ALL_COLORS.filter(c => !next.hiddenColors.includes(c.code))
		const urlsFor = (langs: typeof visibleLangs, colors: typeof visibleColors) =>
			langs.flatMap(l => colors.map(c => `/sound/lang/${l.code}/${c.code}.aac`))
		if (next.flightMode && !settings.flightMode) {
			// just switched on: cache everything currently visible
			cacheAudioUrls(urlsFor(visibleLangs, visibleColors))
		} else if (next.flightMode) {
			// already on: cache only what just became visible
			const newLangs = visibleLangs.filter(l => settings.hiddenLanguages.includes(l.code))
			const newColors = visibleColors.filter(c => settings.hiddenColors.includes(c.code))
			const oldLangs = visibleLangs.filter(l => !settings.hiddenLanguages.includes(l.code))
			const urls = [
				...urlsFor(newLangs, visibleColors),
				...urlsFor(oldLangs, newColors),
			]
			if (urls.length > 0) {
				cacheAudioUrls(urls)
			}
		}

		setSettings(next)
		saveSettings(next)
		applyTheme(next.theme)
	}

	// choose a sort mode for the swatches; choosing random reshuffles every time
	const setSort = (mode: SortMode) => {
		if (mode === 'random') {
			updateSettings({ ...settings, sortMode: 'random', randomOrder: shuffle(ALL_COLORS.map(c => c.code)) })
		} else {
			updateSettings({ ...settings, sortMode: mode })
		}
	}

	const LANGUAGES = ALL_LANGUAGES.filter(l => !settings.hiddenLanguages.includes(l.code))
	// what the main screen actually shows: all colors sorted by the chosen mode,
	// then filtered to the visible ones (hidden swatches still hold their sorted slot)
	const COLORS = sortColors(ALL_COLORS, settings.sortMode, lang, LANGUAGES.length > 0, settings.randomOrder)
		.filter(c => !settings.hiddenColors.includes(c.code))

	// if the selected language gets hidden in settings, fall back to the first visible one
	useEffect(() => {
		if (LANGUAGES.length > 0 && !LANGUAGES.some(l => l.code === lang)) {
			setLang(LANGUAGES[0].code)
			setName('')
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings.hiddenLanguages])

	const playSound = useCallback(async (code: string) => {
		if (mutedRef.current) return
		try {
			const blob = await getAudioBlob(`/sound/lang/${lang}/${code}.aac`)
			if (!blob) return
			const objectUrl = URL.createObjectURL(blob)
			if (playingAudio.current) {
				playingAudio.current.pause()
				URL.revokeObjectURL(playingAudio.current.src)
			}
			const audio = new Audio(objectUrl)
			audio.onended = () => {
				URL.revokeObjectURL(objectUrl)
				setPlayingCode(null)
			}
			playingAudio.current = audio
			await audio.play()
			setPlayingCode(code)
			refreshCacheCount() // playing may have added the file to the cache
		} catch (e) {
			console.error(e)
		}
	}, [lang, refreshCacheCount])

	// play a color sound without touching the play-icon UI (used by the game).
	// Reads from the cache (IndexedDB, works in Safari Lockdown) or the network.
	const playFile = useCallback(async (url: string) => {
		if (mutedRef.current) return
		try {
			const blob = await getAudioBlob(url)
			if (!blob) return
			const objectUrl = URL.createObjectURL(blob)
			if (playingAudio.current) {
				playingAudio.current.pause()
				URL.revokeObjectURL(playingAudio.current.src)
			}
			const audio = new Audio(objectUrl)
			audio.onended = () => URL.revokeObjectURL(objectUrl)
			playingAudio.current = audio
			await audio.play()
		} catch (e) {
			console.error(e)
		}
	}, [])

	// ---- Game mode ----
	const [gameOn, setGameOn] = useState(false)
	const [gameColors, setGameColors] = useState<Color[]>([]) // shuffled board for this game
	const [target, setTarget] = useState<string | null>(null)  // color code to find
	const [solved, setSolved] = useState<string[]>([])         // codes already played (guessed or given up)
	const [wrongGuesses, setWrongGuesses] = useState<string[]>([]) // wrong swatches for the CURRENT target (temporarily disabled)
	const [mistakes, setMistakes] = useState(0)      // wrong taps this game
	const [giveUps, setGiveUps] = useState(0)        // colors given up on this game
	const [gaveUpCodes, setGaveUpCodes] = useState<string[]>([]) // codes given up on, to mark them 🤷‍♂️
	const gameStart = useRef(0)                       // Date.now() when the round began
	// when the round ended (all played, or ✋): freezes the clock and stats until
	// 🔄 starts a new round or 🕹️ leaves game mode; null while a round is running
	const [endedAt, setEndedAt] = useState<number | null>(null)
	const [feedback, setFeedback] = useState<{ emoji: string, id: number } | null>(null)
	const feedbackId = useRef(0)
	const [preparing, setPreparing] = useState(false) // downloading game sounds before start

	// tick every second while a round runs, so the live ⏱️ time updates
	const [, setClockTick] = useState(0)
	useEffect(() => {
		if (!gameOn || endedAt !== null) return
		const id = setInterval(() => setClockTick(t => t + 1), 1000)
		return () => clearInterval(id)
	}, [gameOn, endedAt])

	const canPlayGame = LANGUAGES.length > 0 && COLORS.length > 0

	const formatDuration = (ms: number) => {
		const total = Math.round(ms / 1000)
		const m = Math.floor(total / 60)
		const s = total % 60
		return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
	}

	const flashFeedback = (emoji: string) => {
		feedbackId.current += 1
		const id = feedbackId.current
		setFeedback({ emoji, id })
		setTimeout(() => setFeedback(f => (f && f.id === id ? null : f)), 700)
	}

	// start a round (also used by 🔄 to restart): preload the prompt sounds, reset
	// the counters, pick the first target and turn game mode on
	const startRound = async () => {
		if (!canPlayGame || preparing) return
		stopSound()
		const board = shuffle(COLORS)
		// pre-load every prompt sound before the round begins, so gameplay never waits
		// on the network (cached in IndexedDB, which also works in Safari Lockdown)
		setPreparing(true)
		await ensureCached(board.map(c => `/sound/lang/${lang}/${c.code}.aac`))
		refreshCacheCount()
		setPreparing(false)
		const first = randomOf(board)
		setGameColors(board)
		setSolved([])
		setWrongGuesses([])
		setMistakes(0)
		setGiveUps(0)
		setGaveUpCodes([])
		setEndedAt(null)
		setName('')
		gameStart.current = Date.now()
		setTarget(first.code)
		setGameOn(true)
		playFile(`/sound/lang/${lang}/${first.code}.aac`)
	}

	// 🕹️ off: leave game mode entirely (hides the game score and actions)
	const exitGame = () => {
		stopSound()
		setGameOn(false)
		setTarget(null)
		setWrongGuesses([])
		setFeedback(null)
		setEndedAt(null)
	}

	// ✋: stop the current round early — freeze the clock and stats, stay in game mode
	const stopRound = () => {
		if (target === null) return
		stopSound()
		setTarget(null)
		setWrongGuesses([])
		setEndedAt(Date.now())
	}

	// 👂: play the current prompt again
	const replaySound = () => {
		if (target === null) return
		playFile(`/sound/lang/${lang}/${target}.aac`)
	}

	// mark the target color played and move on (or finish the round)
	const advance = (code: string) => {
		// cancel any not-yet-fired next-prompt timer (e.g. the player answered the
		// last color before the previous prompt was scheduled to play)
		if (promptTimer.current) {
			clearTimeout(promptTimer.current)
			promptTimer.current = null
		}
		// reaching the correct answer re-enables the swatches marked wrong this round
		setWrongGuesses([])
		const nextSolved = [...solved, code]
		setSolved(nextSolved)
		const remaining = gameColors.filter(c => !nextSolved.includes(c.code))
		if (remaining.length === 0) {
			// all colors played — the round is over, but game mode stays on until
			// 🕹️ is clicked again (or 🔄 starts a new round)
			stopSound()
			setTarget(null)
			setEndedAt(Date.now())
		} else {
			const next = randomOf(remaining)
			setTarget(next.code)
			// let the feedback land before the next prompt
			promptTimer.current = setTimeout(() => playFile(`/sound/lang/${lang}/${next.code}.aac`), 650)
		}
	}

	const guessColor = (code: string) => {
		if (target === null || solved.includes(code) || wrongGuesses.includes(code)) return
		if (code === target) {
			if (!mutedRef.current) playFx('correct')
			flashFeedback('👍')
			advance(code)
		} else {
			// temporarily disable this wrong swatch (with a 👎 marker) until the round is won
			setWrongGuesses(w => (w.includes(code) ? w : [...w, code]))
			setMistakes(m => m + 1)
			if (!mutedRef.current) playFx('wrong')
			flashFeedback('👎')
		}
	}

	// give up on the current color: counts as played and as a give-up (not a mistake)
	const giveUp = () => {
		if (target === null) return
		setGiveUps(g => g + 1)
		setGaveUpCodes(g => (g.includes(target) ? g : [...g, target]))
		if (!mutedRef.current) playFx('giveup')
		flashFeedback('🤷‍♂️')
		advance(target)
	}

	const board = gameOn ? gameColors : COLORS
	// what the display segment shows: the prompted name during a round (so the
	// game is playable while muted), otherwise the last clicked name
	const displayText = gameOn && target !== null
		? (gameColors.find(c => c.code === target)?.name[lang] ?? '')
		: name

	return (
		<div className="Colors">
			{/* the app bar's four segments sit right-to-left: toolbar, display,
			    game score, game actions (the last two only in game mode) */}
			<header className="app-bar">
				<div className="toolbar">
				<button
					className={(gameOn ? 'game-toggle on' : 'game-toggle') + (preparing ? ' busy' : '')}
					aria-label={gameOn ? 'End game' : 'Start game'}
					aria-pressed={gameOn}
					title={
						gameOn
							? 'End game mode'
							: (canPlayGame ? 'Start game' : 'Select at least one language and color to play')
					}
					disabled={(!gameOn && !canPlayGame) || preparing}
					onClick={() => (gameOn ? exitGame() : startRound())}
				>
					🕹️
				</button>
				<button
					className={muted ? 'mute-toggle on' : 'mute-toggle'}
					aria-label={muted ? 'Unmute' : 'Mute'}
					aria-pressed={muted}
					title={muted ? 'Unmute sounds' : 'Mute all sounds'}
					onClick={toggleMute}
				>
					{muted ? '🔇' : '🔊'}
				</button>
				<select
					className="language-select"
					title="Language of the color name"
					value={lang}
					disabled={gameOn}
					onChange={(e) => {
						setLang(e.target.value as Language)
						setName('')
						stopSound()
					}}
				>
					{LANGUAGES.map(l => (
						<option key={`lang-${l.code}`} value={l.code}>{l.display}</option>
					))}
				</select>
				<SettingsPanel
					settings={settings}
					languages={ALL_LANGUAGES}
					colors={ALL_COLORS.map(c => ({ code: c.code }))}
					caching={caching}
					cachedCount={cachedCount}
					locked={gameOn}
					onChange={updateSettings}
					onSetSort={setSort}
					onClearCache={clearSoundCache}
				/>
				</div>
				<div className="display">
					<h1 className="display-text">
						{preparing ? '⏳' : displayText}
					</h1>
				</div>
				{gameOn && (
					<div className="game-score">
						<span title="Colors played">🏁 {solved.length} / {gameColors.length}</span>
						<span title="Mistakes">👎 {mistakes}</span>
						<span title="Give-ups">🤷‍♂️ {giveUps}</span>
						<span title="Time">⏱️ {formatDuration((endedAt ?? Date.now()) - gameStart.current)}</span>
					</div>
				)}
				{gameOn && (
					<div className="game-actions">
						<button
							aria-label="Replay the sound"
							title="Play the prompt again"
							disabled={muted || target === null}
							onClick={replaySound}
						>
							👂
						</button>
						<button
							aria-label="Give up"
							title="Give up: reveal this one and move on"
							disabled={target === null}
							onClick={giveUp}
						>
							🤷‍♂️
						</button>
						<button
							aria-label="Stop round"
							title="Stop this round (the score stays until you restart or leave the game)"
							disabled={target === null}
							onClick={stopRound}
						>
							✋
						</button>
						<button
							aria-label="Restart round"
							title="Restart: start a new round"
							disabled={preparing}
							onClick={startRound}
						>
							🔄
						</button>
					</div>
				)}
			</header>
			<hgroup>
				{board.map(c => {
					const isGivenUp = gameOn && gaveUpCodes.includes(c.code)
					const isSolved = gameOn && solved.includes(c.code) && !isGivenUp
					const isWrong = gameOn && wrongGuesses.includes(c.code)
					return (
						<button
							key={`color-${c.code}`}
							className={'button-color' + (playingCode === c.code ? ' playing' : '') + (isWrong ? ' wrong' : '')}
							style={{ backgroundColor: `#${c.code}` }}
							title={gameOn ? '' : (LANGUAGES.length > 0 ? c.name[lang] : '🤷‍♂️')}
							disabled={isSolved || isGivenUp || isWrong}
							onClick={() => {
								if (gameOn) {
									guessColor(c.code)
								} else if (playingCode === c.code) {
									stopSound()
								} else if (LANGUAGES.length === 0) {
									// every language is hidden: nothing to say
									setName('🤷‍♂️')
								} else {
									setName(c.name[lang])
									playSound(c.code)
								}
							}}
						>
							{playingCode === c.code && <span className="play-icon">▶</span>}
							{isSolved && <span className="swatch-mark">👍</span>}
							{isGivenUp && <span className="swatch-mark">🤷‍♂️</span>}
							{isWrong && <span className="swatch-mark">👎</span>}
						</button>
					)
				})}
			</hgroup>
			{feedback && (
				<div key={feedback.id} className="game-feedback" aria-hidden="true">
					{feedback.emoji}
				</div>
			)}
			<Analytics/>
		</div>
	)
}

export default App
