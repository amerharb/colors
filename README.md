[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/amerharb/colors)
# Colors

Small react project to show colors (as swatches) and display the color name in
the selected language. Sister project of
[Flags](https://github.com/amerharb/flags).

## Colors supported
- Red `#F00`
- Green `#0F0`
- Blue `#00F`
- Black `#000`
- White `#FFF`

Colors are defined with 3-digit hex codes.

## Languages supported
- English
- Arabic
- German
- Swedish

## How it works
Pick a language from the dropdown in the top right, then click a color swatch to
hear its name spoken and see it written in that language. Click the swatch again
(▶ while it plays) to stop.

- Settings (⚙️ top right): theme (system / light / dark, system is the default),
  a language checklist and a color grid to show/hide anything on the main screen
  (with ✅/⬜ select-all/deselect-all buttons), a flight mode toggle (✈️), and
  cache info (🔊 count and a 🗑️ clear button). Saved in localStorage, remembered
  between visits.
- Flight mode (✈️): downloads all visible sounds into the browser's Cache Storage
  so they play offline; anything newly shown while it is on is downloaded right
  away. Turning it off keeps the cached files (🗑️ clears them).
- First visit: the starting language and which languages are shown come from your
  browser's language settings.

## How to contribute
### Media files
Each color has one sound file in AAC format per language, with the spoken color
name. Audio files live under `public/sound/lang/<lang>/<code>.aac`, for example
`public/sound/lang/en/f00.aac` for Red in English (the `<code>` is the color's
3-digit hex).

### Coding
Colors is an open source project built on Vite, React 19, TypeScript v6.x and
npm. All the code is Frontend, no backend needed.

To add a color:
1. Create `src/colors/<code>.ts` exporting a `Color` (`code`, `name`) with the
   name in every supported language.
2. Import it and add it to the `ALL_COLORS` array in `src/App.tsx`.
3. Drop the audio files at `public/sound/lang/<lang>/<code>.aac`.

To add a language:
1. Add its code to the `Language` type in `src/colors/Color.ts` — TypeScript will
   then point out every color file missing the new name.
2. Add it to the `LANGUAGE_DEFS` array in `src/App.tsx` and to `SPOKEN_LANGUAGES`
   in `src/settingsStore.ts`.
3. Drop the audio files at `public/sound/lang/<lang>/<code>.aac`.

#### Setup environment
- Node 20.19 or above
- npm 9.x or above
- Install `npm install`
- Build: `npm run build` (output in `dist/`)
- Start dev server: `npm start`
- Preview production build: `npm run preview`

## Credits
### For sound
Color name pronunciations synthesized with the macOS `say` text-to-speech
voices: English (Samantha), Arabic (Majed), German (Anna) and Swedish (Alva).
