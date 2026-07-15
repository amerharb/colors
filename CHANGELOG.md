# Changelog

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
