import './App.css'
import { useCallback, useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import SettingsPanel from './SettingsPanel'
import { GameScore, GameActions } from './GameHud'
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
import { ensureCached, idbCount, idbClear } from './audioCache'
import { useAudio } from './useAudio'
import { useGame } from './useGame'
import { useFitText } from './useFitText'
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

	// true while flight-mode downloads are in progress, to show it on the toggle
	const [caching, setCaching] = useState(false)
	// how many sound files are currently in the cache, shown in settings
	const [cachedCount, setCachedCount] = useState(0)

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

	// playback, mute and the feedback sounds
	const audio = useAudio(refreshCacheCount)

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
			(audio.playingCode && next.hiddenColors.includes(audio.playingCode)) ||
			next.hiddenLanguages.includes(lang)
		) {
			audio.stopSound()
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

	// the sound file of a color's name in the selected language
	const colorUrl = (code: string) => `/sound/lang/${lang}/${code}.aac`

	// the game: the swatches shuffle on every round — only the prompts are random too
	const game = useGame<Color>({
		canPlay: LANGUAGES.length > 0 && COLORS.length > 0,
		buildBoard: () => shuffle(COLORS),
		promptUrl: c => colorUrl(c.code),
		preload: async urls => {
			await ensureCached(urls)
			refreshCacheCount()
		},
		audio,
		onRoundStart: () => setName(''),
	})

	const board = game.gameOn ? game.board : COLORS
	// what the display segment shows: the prompted name during a round (so the
	// game is playable while muted), otherwise the last clicked name
	const displayText = game.gameOn && game.target !== null
		? (game.board.find(c => c.code === game.target)?.name[lang] ?? '')
		: name

	// shrink the display font before falling back to the marquee
	const displayRef = useFitText(displayText)

	return (
		<div className="Colors">
			{/* the app bar's four segments sit right-to-left: toolbar, display,
			    game score, game actions (the last two only in game mode) */}
			<header className="app-bar">
				<div className="toolbar">
					<button
						className={(game.gameOn ? 'game-toggle on' : 'game-toggle') + (game.preparing ? ' busy' : '')}
						aria-label={game.gameOn ? 'End game mode' : 'Start game'}
						aria-pressed={game.gameOn}
						title={
							game.gameOn
								? 'End game mode'
								: (game.canPlay ? 'Start game' : 'Select at least one language and color to play')
						}
						disabled={(!game.gameOn && !game.canPlay) || game.preparing}
						onClick={() => (game.gameOn ? game.exitGame() : game.startRound())}
					>
						🕹️
					</button>
					<button
						className={audio.muted ? 'mute-toggle on' : 'mute-toggle'}
						aria-label={audio.muted ? 'Unmute' : 'Mute'}
						aria-pressed={audio.muted}
						title={audio.muted ? 'Unmute sounds' : 'Mute all sounds'}
						onClick={audio.toggleMute}
					>
						{audio.muted ? '🔇' : '🔊'}
					</button>
					<select
						className="language-select"
						title="Language of the color name"
						value={lang}
						disabled={game.gameOn}
						onChange={(e) => {
							setLang(e.target.value as Language)
							setName('')
							audio.stopSound()
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
						locked={game.gameOn}
						onChange={updateSettings}
						onSetSort={setSort}
						onClearCache={clearSoundCache}
					/>
				</div>
				<div className="display">
					<h1 className="display-text" ref={displayRef}>
						{game.preparing ? '⏳' : displayText}
					</h1>
				</div>
				{game.gameOn && (
					<GameScore
						playedTitle="Colors played"
						played={game.solved.length}
						total={game.board.length}
						mistakes={game.mistakes}
						giveUps={game.giveUps}
						ms={game.elapsedMs}
					/>
				)}
				{game.gameOn && (
					<GameActions
						roundActive={game.target !== null}
						muted={audio.muted}
						preparing={game.preparing}
						onReplay={game.replay}
						onGiveUp={game.giveUp}
						onStop={game.stopRound}
						onRestart={game.startRound}
					/>
				)}
			</header>
			<hgroup>
				{board.map(c => {
					const isGivenUp = game.gameOn && game.gaveUpCodes.includes(c.code)
					const isSolved = game.gameOn && game.solved.includes(c.code) && !isGivenUp
					const isWrong = game.gameOn && game.wrongGuesses.includes(c.code)
					return (
						<button
							key={`color-${c.code}`}
							className={'button-color' + (audio.playingCode === c.code ? ' playing' : '') + (isWrong ? ' wrong' : '')}
							style={{ backgroundColor: `#${c.code}` }}
							title={game.gameOn ? '' : (LANGUAGES.length > 0 ? c.name[lang] : '🤷‍♂️')}
							disabled={isSolved || isGivenUp || isWrong}
							onClick={() => {
								if (game.gameOn) {
									game.guess(c.code)
								} else if (audio.playingCode === c.code) {
									audio.stopSound()
								} else if (LANGUAGES.length === 0) {
									// every language is hidden: nothing to say
									setName('🤷‍♂️')
								} else {
									setName(c.name[lang])
									audio.play(colorUrl(c.code), c.code)
								}
							}}
						>
							{audio.playingCode === c.code && <span className="play-icon">▶</span>}
							{isSolved && <span className="swatch-mark">👍</span>}
							{isGivenUp && <span className="swatch-mark">🤷‍♂️</span>}
							{isWrong && <span className="swatch-mark">👎</span>}
						</button>
					)
				})}
			</hgroup>
			{game.feedback && (
				<div key={game.feedback.id} className="game-feedback" aria-hidden="true">
					{game.feedback.emoji}
				</div>
			)}
			<Analytics/>
		</div>
	)
}

export default App
