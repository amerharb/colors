import './App.css'
import { useEffect, useState } from 'react'
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

	// user settings (theme + which languages/colors to show on the main screen)
	const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
	useEffect(() => {
		const loaded = loadSettings()
		setSettings(loaded)
		applyTheme(loaded.theme)
	}, [])
	const updateSettings = (next: Settings) => {
		setSettings(next)
		saveSettings(next)
		applyTheme(next.theme)
	}

	// what the main screen actually shows
	const COLORS = ALL_COLORS.filter(c => !settings.hiddenColors.includes(c.code))
	const LANGUAGES = ALL_LANGUAGES.filter(l => !settings.hiddenLanguages.includes(l.code))

	// language of the displayed color name; defaults to the browser's preferred
	// language on first load (the fallback effect below keeps it visible)
	const [lang, setLang] = useState<Language>(() => preferredLanguage())
	const [name, setName] = useState('')

	// if the selected language gets hidden in settings, fall back to the first visible one
	useEffect(() => {
		if (LANGUAGES.length > 0 && !LANGUAGES.some(l => l.code === lang)) {
			setLang(LANGUAGES[0].code)
			setName('')
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [settings.hiddenLanguages])

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
						className="button-color"
						style={{ backgroundColor: `#${c.code}` }}
						title={LANGUAGES.length > 0 ? c.name[lang] : '🤷‍♂️'}
						onClick={() => setName(LANGUAGES.length > 0 ? c.name[lang] : '🤷‍♂️')}
					/>
				))}
			</hgroup>
			<hgroup>
				<h1>{name}</h1>
			</hgroup>
		</div>
	)
}

export default App
