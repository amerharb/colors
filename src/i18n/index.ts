/*
 * Tiny UI-string localization. The interface follows the selected color-name
 * language; any key missing in that language falls back to English. English
 * (en.json) is the source of truth for the full key set — the other files are
 * translations and may omit keys (they'll fall back).
 */
import { Language } from '../colors/Color'
import en from './en.json'
import ar from './ar.json'
import de from './de.json'
import sv from './sv.json'

export type MsgKey = keyof typeof en
// accepts any string so the shared presentational components can stay decoupled
// from this key set; an unknown key resolves to itself as a last resort
export type Translate = (key: string) => string

const DICTS: Record<Language, Partial<Record<MsgKey, string>>> = { en, ar, de, sv }

// a translate function for the given language, falling back to English
export function translator(lang: Language): Translate {
	const dict: Partial<Record<string, string>> = DICTS[lang] ?? {}
	const base: Partial<Record<string, string>> = en
	return (key) => dict[key] ?? base[key] ?? key
}
