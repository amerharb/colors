# Changelog

## [0.16.0] 2026-07-20
### Added
- Localize the interface: all UI text (button tooltips, the "select a language
  and color to play" hint, settings labels, game score/actions) now lives in
  `src/i18n/*.json`, falling back to English for any missing string
- Add an interface-language dropdown (👁️) to the settings panel with the four
  localized languages (English, Arabic, German, Swedish). It is now a separate,
  persisted setting — independent of the content/color-name dropdown — so the
  UI and the color names can be in different languages. On first run it follows
  the browser (primary language, then any of the browser's languages, else the
  content-language pick, else English)
- Show the content-language names (in the top dropdown and the settings
  checklist) in the current interface language — e.g. "Arabic" in an English
  UI, "Arabisch" in a German UI — falling back to the native name for any
  untranslated pair. The interface-language dropdown itself keeps native names
  (English, عربي, Deutsch, Svenska) so it is always self-findable
- Sort the content-language options (top dropdown and settings checklist)
  alphabetically by their displayed name, using the interface language's
  collation (so the order updates with the UI language)
- Add Pink `#F7B` and Purple `#707` (with spoken names in all four languages)
- Add Gray and Brown with spoken names and Microsoft Edge neural recordings
  (Ava, Amany, Katja, Sofie) in all four languages (beta — remove the `beta`
  flag to promote to production)
### Changed
- Re-code Orange `f80` → `f70`: the `8` was a mistake, and `7` is the halfway
  point to `f` so the colors keep even hex steps (the spoken name is unchanged,
  the sound files moved to the new code). A shared link with the old `?c=f80`
  no longer matches Orange
- Replace all the color-name recordings with more natural Microsoft Edge
  neural text-to-speech voices — Ava (English), Amany (Arabic), Katja (German)
  and Sofie (Swedish), the same roster as the sister projects — instead of the
  old macOS `say` voices (Samantha, Majed, Anna, Alva). If the old files are
  already in the sound cache, clear it (🗑️) to hear the new voices
- In game mode with the round stopped (finished or ✋), the selected language
  can be changed again — the next 🔄 round uses it. It stays locked while a
  round is running, and showing or hiding languages/items in settings stays
  locked for the whole game mode
- Internal refactor (no behaviour change): App.tsx is split into focused
  modules shared verbatim with the sister projects — `useAudio` (playback,
  mute, feedback sounds), `useGame` (the round state machine), `GameHud` (the
  score and action segments) and `useFitText` (the display shrink-to-fit) —
  cutting App.tsx from ~615 to ~360 lines

## 0.15.0
### Fixed
- Pressed and selected controls are now clearly visible in dark mode: a new
  shared `--active-bg` accent (the steel blue Flags already used) backs the
  game and mute toggles, the open settings gear, selected segments and the
  flight-mode toggle. They previously used `--surface-hover`, which in dark
  mode is nearly identical to the normal button background
### Added
- Add a mute toggle (🔊/🔇) in the toolbar, right of the game button: while
  muted nothing plays — names, game prompts or feedback sounds — and whatever
  is playing at that moment stops
- During a round, the prompted color's name is written in the display
  segment (muted or not), so the game can also be played by reading
- Add a replay button (👂) to the game actions: plays the current prompt
  again; disabled while muted or between rounds
- Add `vercel.json` (framework Vite, output directory `dist`) so the Vercel
  deployment configuration is explicit and versioned, like the sister project
  Arqaam
### Changed
- Change the game toggle emoji from 🎮 to 🕹️ (the classic joystick)
- Restructure the top of the app into one sticky app bar with four segments,
  right-to-left: toolbar (🕹️ game, 🔊 mute, language, ⚙️ settings), display
  (the spoken name), live game score (🏁 played 👎 mistakes 🤷‍♂️ give-ups
  ⏱️ time, ticking every second) and game actions. The game segments anchor
  to the left, the toolbar to the right, and the display stretches between
  them — a long name first shrinks its font (down to a limit) and only then
  auto-scrolls back and forth. The game segments only appear in game mode,
  unfolding with a smooth transition; on narrow screens the bar stacks the
  segments top-to-bottom in the same order, with the display on a full row
- The game no longer ends by itself: when every color has been played the
  round is over — the clock freezes and the score stays — but game mode
  stays on. New round actions sit next to the give-up button (🤷‍♂️): stop
  (✋) ends the current round early and restart (🔄) starts a fresh one;
  clicking 🕹️ again leaves game mode and hides the game score and actions
- In the game result, show the mistakes count with 👎 instead of ❌, matching
  the marker shown on a wrong guess
- Redraw the favicon in the sister projects' shared flat style: four bold
  color squares (red, green, blue, yellow) without the old white tile and
  border

## 0.14.0
- Align version with the sister project Flags.
### Added
- Support URL parameters for a shareable view: `c` sets which colors are shown
  (e.g. `?c=f00,0f0,00f`) and `l` sets which languages are shown with the first
  one selected (e.g. `?l=en,ar`). List order does not affect the on-screen order.
- Add a color sort setting: by color code (🌈, default), by the selected
  language's names (🗣️, so switching language re-sorts; falls back to code when
  no language is selected), or random (🎲, reshuffles every time you choose it).
  The random order covers hidden colors too, so each keeps its slot when shown.
### Changed
- In the game, disabled swatches (solved or guessed wrong) keep their true
  color instead of being dimmed — the state is shown only by a corner marker
  (👍 solved, 👎 wrong), so the color is never misrepresented
- a swatch revealed with "I don't know" is marked 🤷‍♂️ instead of 👍 and plays a
  distinct give-up sound
- In the game, a wrong swatch is temporarily disabled with a 👎 marker so you
  can't tap it again; all such swatches re-enable once you find the correct one
- Cache all sounds in a single store (IndexedDB) instead of the previous mix of
  Cache Storage and an in-memory map. Simpler, persists across reloads, works in
  Safari Lockdown Mode, and drops the 7-day TTL (the cache lives until cleared
  with the 🗑️ button)

### Fixed
- In the game, answering the final color before the previous prompt's sound
  was scheduled to play no longer leaves that sound playing after the game ends
  (the pending next-prompt timer is now cancelled)

## 0.2.0
- Add game mode (🎮): a random color name is spoken and you tap the matching
  swatch (👍 correct, 👎 wrong), with a give-up button (🤷‍♂️). Runs through every
  visible color, then shows played / mistakes / give-ups / time. Language and
  color lists lock during a game; theme and flight mode stay changeable. Prompt
  sounds are pre-loaded into memory so gameplay never waits on the network.

## 0.1.0
- Add colors: Orange `#F80` and Yellow `#FF0` (with spoken names in all four
  languages).

## 0.0.1
- Initial release.
- Colors: Red `#F00`, Green `#0F0`, Blue `#00F`, Black `#000`, White `#FFF`
  (3-digit hex codes).
- Languages: English, Arabic, German, Swedish.
- Click a color swatch to hear its name spoken and see it in the selected
  language (AAC sound files per language under `public/sound/lang/`); click again
  to stop.
- Settings (⚙️): theme (system / light / dark), plus language and color
  show/hide checklists, persisted in localStorage.
- Flight mode (✈️): caches all visible sound files in the browser's Cache Storage
  for offline playback, with a cache count (🔊) and clear button (🗑️); newly
  shown languages/colors are cached immediately, and turning it off keeps the
  cached files.
