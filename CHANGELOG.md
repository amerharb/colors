# Changelog

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
