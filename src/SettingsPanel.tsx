import { useEffect, useRef, useState } from 'react'
import { Language } from './colors/Color'
import { Theme, SortMode, Settings } from './settingsStore'

// structural type so this stays app-agnostic (no import from i18n)
type Translate = (key: string) => string

const THEME_OPTIONS: { value: Theme, icon: string, key: string }[] = [
	{ value: 'system', icon: '🖥️', key: 'theme.system' },
	{ value: 'light', icon: '☀️', key: 'theme.light' },
	{ value: 'dark', icon: '🌙', key: 'theme.dark' },
]

const SORT_OPTIONS: { value: SortMode, icon: string, key: string }[] = [
	{ value: 'code', icon: '🌈', key: 'sort.code' },
	{ value: 'lang', icon: '🗣️', key: 'sort.lang' },
	{ value: 'random', icon: '🎲', key: 'sort.random' },
]

type Props = {
	settings: Settings,
	// full (beta-filtered) lists, so the checklists always show everything supported
	languages: { code: Language, display: string }[],
	colors: { code: string }[],
	// true while flight-mode downloads are running
	caching: boolean,
	// number of sound files currently in the cache
	cachedCount: number,
	// when true (game in progress), the language and color lists can't be changed
	locked: boolean,
	// UI-string translator (falls back to English)
	t: Translate,
	// the current interface language and the options for its dropdown
	uiLanguage: string,
	uiLanguages: { code: string, display: string }[],
	onSetUiLanguage: (code: string) => void,
	onChange: (settings: Settings) => void,
	onSetSort: (mode: SortMode) => void,
	onClearCache: () => void,
}

export default function SettingsPanel({ settings, languages, colors, caching, cachedCount, locked, t, uiLanguage, uiLanguages, onSetUiLanguage, onChange, onSetSort, onClearCache }: Readonly<Props>) {
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement | null>(null)

	// close the panel when clicking anywhere outside it
	useEffect(() => {
		if (!open) return
		const handleOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleOutside)
		return () => document.removeEventListener('mousedown', handleOutside)
	}, [open])

	const setTheme = (theme: Theme) => onChange({ ...settings, theme })

	const toggleLanguage = (code: Language) => {
		const hiddenLanguages = settings.hiddenLanguages.includes(code)
			? settings.hiddenLanguages.filter(c => c !== code)
			: [...settings.hiddenLanguages, code]
		onChange({ ...settings, hiddenLanguages })
	}

	const toggleColor = (code: string) => {
		const hiddenColors = settings.hiddenColors.includes(code)
			? settings.hiddenColors.filter(c => c !== code)
			: [...settings.hiddenColors, code]
		onChange({ ...settings, hiddenColors })
	}

	const showAllLanguages = () => onChange({ ...settings, hiddenLanguages: [] })
	const hideAllLanguages = () => onChange({ ...settings, hiddenLanguages: languages.map(l => l.code) })
	const showAllColors = () => onChange({ ...settings, hiddenColors: [] })
	const hideAllColors = () => onChange({ ...settings, hiddenColors: colors.map(c => c.code) })

	return (
		<div className="settings" ref={containerRef}>
			<button
				type="button"
				className={open ? 'settings-button open' : 'settings-button'}
				aria-label={t('settings.title')}
				aria-expanded={open}
				title={t('settings.title')}
				onClick={() => setOpen(o => !o)}
			>
				⚙️
			</button>

			{open && (
				<div className="settings-panel" role="dialog" aria-label={t('settings.title')}>
					<div className="settings-row">
						<div className="settings-segmented" role="group" aria-label={t('group.theme')}>
							{THEME_OPTIONS.map(opt => (
								<button
									key={opt.value}
									type="button"
									className={settings.theme === opt.value ? 'segment selected' : 'segment'}
									aria-pressed={settings.theme === opt.value}
									aria-label={t(opt.key)}
									title={t(opt.key)}
									onClick={() => setTheme(opt.value)}
								>
									{opt.icon}
								</button>
							))}
						</div>
					</div>

					<div className="settings-row">
						<label className="settings-uilang">
							<span className="settings-uilang-icon" aria-hidden="true">👁️</span>
							<select
								className="language-select"
								aria-label={t('uiLanguage')}
								title={t('uiLanguage')}
								value={uiLanguage}
								onChange={(e) => onSetUiLanguage(e.target.value)}
							>
								{uiLanguages.map(l => (
									<option key={`ui-${l.code}`} value={l.code}>{l.display}</option>
								))}
							</select>
						</label>
					</div>

					<div className="settings-row">
						<div className="settings-segmented" role="group" aria-label={t('group.sort')}>
							<span className="settings-segmented-icon" aria-hidden="true">⇵</span>
							{SORT_OPTIONS.map(opt => (
								<button
									key={opt.value}
									type="button"
									className={settings.sortMode === opt.value ? 'segment selected' : 'segment'}
									aria-pressed={settings.sortMode === opt.value}
									aria-label={t(opt.key)}
									title={t(opt.key)}
									onClick={() => onSetSort(opt.value)}
								>
									{opt.icon}
								</button>
							))}
						</div>
					</div>

					<div className="settings-row">
						<div className="settings-select-all">
							<button
								type="button"
								aria-label={t('selectAllLanguages')}
								title={t('selectAll')}
								disabled={locked}
								onClick={showAllLanguages}
							>
								✅
							</button>
							<button
								type="button"
								aria-label={t('deselectAllLanguages')}
								title={t('deselectAll')}
								disabled={locked}
								onClick={hideAllLanguages}
							>
								⬜
							</button>
						</div>
						<div className="settings-checklist" role="group" aria-label={t('group.languages')}>
							{languages.map(l => {
								const shown = !settings.hiddenLanguages.includes(l.code)
								return (
									<label key={`setting-lang-${l.code}`} className="settings-check">
										<input
											type="checkbox"
											checked={shown}
											disabled={locked}
											onChange={() => toggleLanguage(l.code)}
										/>
										{l.display}
									</label>
								)
							})}
						</div>
					</div>

					<div className="settings-row">
						<div className="settings-select-all">
							<button
								type="button"
								aria-label={t('selectAllColors')}
								title={t('selectAll')}
								disabled={locked}
								onClick={showAllColors}
							>
								✅
							</button>
							<button
								type="button"
								aria-label={t('deselectAllColors')}
								title={t('deselectAll')}
								disabled={locked}
								onClick={hideAllColors}
							>
								⬜
							</button>
						</div>
						<div className="settings-color-grid" role="group" aria-label={t('group.colors')}>
							{colors.map(c => {
								const shown = !settings.hiddenColors.includes(c.code)
								return (
									<button
										key={`setting-color-${c.code}`}
										type="button"
										className={shown ? 'color-toggle' : 'color-toggle hidden'}
										style={{ backgroundColor: `#${c.code}` }}
										aria-pressed={shown}
										aria-label={c.code}
										title={c.code}
										disabled={locked}
										onClick={() => toggleColor(c.code)}
									/>
								)
							})}
						</div>
					</div>

					<div className="settings-cache-row">
						<button
							type="button"
							className={
								'settings-flight-mode'
								+ (settings.flightMode ? ' on' : '')
								+ (caching ? ' busy' : '')
							}
							aria-label={t('flight.label')}
							aria-pressed={settings.flightMode}
							title={t('flight.title')}
							onClick={() => onChange({ ...settings, flightMode: !settings.flightMode })}
						>
							✈️
						</button>
						<span className="settings-cache-count" title={t('cache.count')}>
							🔊 {cachedCount}
						</span>
						<button
							type="button"
							className="settings-cache-clear"
							aria-label={t('cache.clear')}
							title={settings.flightMode
								? t('cache.clearTitleDisabled')
								: t('cache.clearTitle')}
							disabled={settings.flightMode || caching}
							onClick={onClearCache}
						>
							🗑️
						</button>
					</div>

					<div className="settings-about">
						<span>v{__APP_VERSION__}</span>
						<a
							href="https://github.com/amerharb/colors"
							target="_blank"
							rel="noopener noreferrer"
						>
							Amer Harb · GitHub
						</a>
					</div>
				</div>
			)}
		</div>
	)
}
