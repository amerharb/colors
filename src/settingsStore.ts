/*
 * User settings, persisted in localStorage (not cookies: this is a front-end
 * only app, so there's no server that needs them, and localStorage avoids
 * sending the data on every request). Stored as one JSON blob under STORAGE_KEY
 * so new settings can be added over time without new storage keys.
 */
import { Language } from './colors/Color'

export type Theme = 'system' | 'light' | 'dark'

// how the swatches are ordered on the main screen:
//   'code'   — by color code / hex (the default)
//   'lang'   — by the color's name in the selected language (falls back to code)
//   'random' — a fixed random order (see Settings.randomOrder)
export type SortMode = 'code' | 'lang' | 'random'

export type Settings = {
	theme: Theme,
	// the interface language (button tooltips, settings labels): one of the four
	// localized languages, independent of the content (color-name) language
	uiLanguage: Language,
	// codes the user chose to hide from the main screen; empty = show everything,
	// so newly added languages/colors are visible by default
	hiddenLanguages: Language[],
	hiddenColors: string[],
	// when on, all visible sounds are downloaded to the cache, and newly shown
	// languages/colors are cached as soon as they are enabled
	flightMode: boolean,
	// order the swatches are shown in on the main screen
	sortMode: SortMode,
	// the frozen random order (color codes) used when sortMode === 'random'.
	// covers every color, including hidden ones, so a swatch keeps its slot when shown.
	randomOrder: string[],
}

export const DEFAULT_SETTINGS: Settings = {
	theme: 'system',
	uiLanguage: 'en',
	hiddenLanguages: [],
	hiddenColors: [],
	flightMode: false,
	sortMode: 'code',
	randomOrder: [],
}

const STORAGE_KEY = 'colors:settings'

// all supported languages that a browser locale can match
const SPOKEN_LANGUAGES: Language[] = ['en', 'ar', 'de', 'sv']

// map a BCP-47 tag (e.g. "en-US", "sv") to one of our language codes, or null
function tagToLanguage(tag: string): Language | null {
	const primary = tag.toLowerCase().split('-')[0]
	return (SPOKEN_LANGUAGES as string[]).includes(primary) ? primary as Language : null
}

// the browser's preferred language, mapped to a supported code (falls back to English)
export function preferredLanguage(): Language {
	const tag = (typeof navigator !== 'undefined' && navigator.language) || ''
	return tagToLanguage(tag) ?? 'en'
}

// the first-run interface language:
//   1) the browser's primary language, if a supported UI language
//   2) else the first of the browser's other languages that is supported
//   3) else the content-language pick (which itself falls back to English)
export function preferredUiLanguage(): Language {
	const primary = tagToLanguage((typeof navigator !== 'undefined' && navigator.language) || '')
	if (primary) return primary
	const tags = (typeof navigator !== 'undefined' && navigator.languages) || []
	for (const tag of tags) {
		const m = tagToLanguage(tag)
		if (m) return m
	}
	return preferredLanguage()
}

// first-run settings: show only the browser's languages (navigator.languages) plus
// the preferred one; everything else starts hidden. The UI language follows the
// browser too (see preferredUiLanguage).
function firstRunSettings(): Settings {
	const tags = (typeof navigator !== 'undefined' && navigator.languages) || []
	const visible = new Set<Language>(tags.map(tagToLanguage).filter(Boolean) as Language[])
	visible.add(preferredLanguage())
	const hiddenLanguages = SPOKEN_LANGUAGES.filter(code => !visible.has(code))
	return { ...DEFAULT_SETTINGS, uiLanguage: preferredUiLanguage(), hiddenLanguages }
}

export function loadSettings(): Settings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (raw) {
			return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
		}
	} catch {
		// localStorage may be unavailable (e.g. private mode); fall back to defaults
	}
	// no saved settings: derive first-run visibility from the browser's languages
	return firstRunSettings()
}

export function saveSettings(settings: Settings): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
	} catch {
		// ignore: settings still apply for the current session
	}
}

// Drive the CSS `color-scheme` via the data-theme attribute on <html>.
export function applyTheme(theme: Theme): void {
	const root = document.documentElement
	if (theme === 'system') {
		root.removeAttribute('data-theme')
	} else {
		root.setAttribute('data-theme', theme)
	}
}
