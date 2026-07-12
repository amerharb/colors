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
import { orange } from './colors/f80'
import { yellow } from './colors/ff0'
import { green } from './colors/0f0'
import { blue } from './colors/00f'
import { black } from './colors/000'
import { white } from './colors/fff'

function App() {
	// everything the build supports (after the beta feature flag)
	const ALL_COLORS: Color[] = [red, orange, yellow, green, blue, black, white].filter(isVisible)
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

	const stopSound = useCallback(() => {
		if (playingAudio.current) {
			playingAudio.current.pause()
			URL.revokeObjectURL(playingAudio.current.src)
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

	const refreshCacheCount = useCallback(async () => {
		if (!('caches' in globalThis)) return
		try {
			const audioCache = await caches.open('audio-cache')
			setCachedCount((await audioCache.keys()).length)
		} catch {
			// leave the previous count
		}
	}, [])
	useEffect(() => {
		refreshCacheCount()
	}, [refreshCacheCount])

	// delete only the downloaded sound files (settings stay); not allowed in flight mode
	const clearSoundCache = useCallback(async () => {
		if (!('caches' in globalThis)) return
		await Promise.all([
			caches.delete('audio-cache'),
			caches.delete('audio-cache-timestamps'),
		])
		setCachedCount(0)
	}, [])

	async function getAudio(audioUrl: string) {
		const TTL = 1000 * 60 * 60 * 24 * 7 // 7 days
		if ('caches' in globalThis) {
			const audioCache = await caches.open('audio-cache')
			const audioCacheTimestamps = await caches.open('audio-cache-timestamps')
			const cachedResponse = await audioCache.match(audioUrl)

			if (cachedResponse) {
				const timestampResponse = await audioCacheTimestamps.match(audioUrl)
				if (timestampResponse) {
					const timestamp = await timestampResponse.text()
					const cachedTime = Number(timestamp)
					const currentTime = Date.now()

					if (currentTime - cachedTime > TTL) {
						await Promise.all([
							audioCache.delete(audioUrl),
							audioCacheTimestamps.delete(audioUrl),
						])
					} else {
						return cachedResponse
					}
				}
			}

			const response = await fetch(audioUrl)
			// skip caching if response failed or empty, so a 404 page is never cached as audio
			if (!response.ok || !response.headers.get('Content-Length') || response.headers.get('Content-Length') === '0') {
				return response
			}

			await audioCache.put(audioUrl, response.clone())
			const timestampResponse = new Response(Date.now().toString())
			await audioCacheTimestamps.put(audioUrl, timestampResponse)

			return response
		} else {
			return await fetch(audioUrl)
		}
	}

	// Download the given sound files into the cache (already-cached ones are skipped,
	// so incremental calls only fetch what is missing). Never deletes anything:
	// switching flight mode off keeps the cached files.
	async function cacheAudioUrls(audioUrls: string[]) {
		// Some browsers like Safari disable Cache Storage in lockdown mode
		if (!('caches' in globalThis)) {
			console.warn('Cache Storage API not available; skipping flight mode cache')
			return
		}
		setCaching(true)
		try {
			const [audioCache, audioCacheTimestamps] = await Promise.all([
				caches.open('audio-cache'),
				caches.open('audio-cache-timestamps'),
			])

			await Promise.all(
				audioUrls.map(async url => {
					try {
						// already downloaded earlier — keep it
						if (await audioCache.match(url)) {
							return
						}
						const res = await fetch(url)
						if (res.ok && res.body && res.headers.get('Content-Length') && res.headers.get('Content-Length') !== '0') {
							await Promise.all([
								audioCache.put(url, res.clone()),
								audioCacheTimestamps.put(url, new Response(Date.now().toString())),
							])
						} else {
							console.warn(`Failed to cache: ${url} (status: ${res.status})`)
						}
					} catch (err) {
						console.error(`Error fetching ${url}:`, err)
					}
				}),
			)
		} catch (error) {
			console.error('Failed to cache audio files:', error)
		} finally {
			setCaching(false)
			refreshCacheCount()
		}
	}

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

	const playSound = useCallback(async (code: string) => {
		try {
			const audioUrl = `/sound/lang/${lang}/${code}.aac`
			const response = await getAudio(audioUrl)
			const blob = await response.blob()
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [lang, refreshCacheCount])

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
					caching={caching}
					cachedCount={cachedCount}
					onChange={updateSettings}
					onClearCache={clearSoundCache}
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
