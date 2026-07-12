import './App.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import SettingsPanel from './SettingsPanel'
import { Color, Language } from './colors/Color'
import { isVisible } from './featureFlags'
import {
	Settings,
	DEFAULT_SETTINGS,
	loadSettings,
	saveSettings,
	applyTheme,
	preferredLanguage,
} from './settingsStore'
import { red } from './colors/f00'
import { green } from './colors/0f0'
import { blue } from './colors/00f'
import { black } from './colors/000'
import { white } from './colors/fff'

function App() {
	// everything the build supports (after the beta feature flag)
	const ALL_COLORS: Color[] = [red, green, blue, black, white].filter(isVisible)
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

	const stopSound = useCallback(() => {
		if (playingAudio.current) {
			playingAudio.current.pause()
			playingAudio.current = null
		}
		setPlayingCode(null)
	}, [])

	// user settings (theme + which languages/colors to show on the main screen)
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
	useEffect(() => {
		const loaded = loadSettings()
		setSettings(loaded)
		applyTheme(loaded.theme)
	}, [])

	// language of the displayed and spoken color name; defaults to the browser's
	// preferred language on first load (the fallback effect below keeps it visible)
	const [lang, setLang] = useState<Language>(() => preferredLanguage())
	const [name, setName] = useState('')

	const updateSettings = (next: Settings) => {
		// stop playback when its color, or the selected language, just got hidden —
		// otherwise the sound would keep playing with no button left to stop it
		if (
			(playingCode && next.hiddenColors.includes(playingCode)) ||
			next.hiddenLanguages.includes(lang)
		) {
			stopSound()
		}
		setSettings(next)
		saveSettings(next)
		applyTheme(next.theme)
	}

	// what the main screen actually shows
	const COLORS = ALL_COLORS.filter(c => !settings.hiddenColors.includes(c.code))
	const LANGUAGES = ALL_LANGUAGES.filter(l => !settings.hiddenLanguages.includes(l.code))

	// if the selected language gets hidden in settings, fall back to the first visible one
	useEffect(() => {
		if (LANGUAGES.length > 0 && !LANGUAGES.some(l => l.code === lang)) {
			setLang(LANGUAGES[0].code)
			setName('')
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings.hiddenLanguages])

	const playSound = useCallback((code: string) => {
		stopSound()
		const audio = new Audio(`/sound/lang/${lang}/${code}.aac`)
		audio.onended = () => setPlayingCode(null)
		audio.play().catch(() => {})
		playingAudio.current = audio
		setPlayingCode(code)
	}, [lang, stopSound])

	return (
		<div className="Colors">
			<div className="top-controls">
				<select
					className="language-select"
					title="Language of the color name"
					value={lang}
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
					onChange={updateSettings}
				/>
			</div>
			<hgroup>
				{COLORS.map(c => (
					<button
						key={`color-${c.code}`}
						className={playingCode === c.code ? 'button-color playing' : 'button-color'}
						style={{ backgroundColor: `#${c.code}` }}
						title={LANGUAGES.length > 0 ? c.name[lang] : '🤷‍♂️'}
						onClick={() => {
							if (LANGUAGES.length === 0) {
								// every language is hidden: nothing to say
								setName('🤷‍♂️')
							} else if (playingCode === c.code) {
								stopSound()
							} else {
								setName(c.name[lang])
								playSound(c.code)
							}
						}}
					>
						{playingCode === c.code && <span className="play-icon">▶</span>}
					</button>
				))}
			</hgroup>
			<hgroup>
				<h1>{name}</h1>
			</hgroup>
		</div>
	)
}

export default App
