# Score Viewer

A React component for reading and listening to scores encoded in
[MEI](https://music-encoding.org/), rendered with [verovio](https://www.verovio.org/).
It is also available as a standalone page to embed with an `<iframe>`.

- **Score**: paginated rendering with zoom, fullscreen, section titles, a choice of verses,
  measure numbers, original clefs, coloured notes, harmonic analysis, normalized ficta and
  undoing the encoded transposition.
- **Critical apparatus**: editorial interventions (`sic`/`corr`, `orig`/`reg`,
  `abbr`/`expan`, `add`/`del`, `supplied`, `unclear`, `damage`, `annot`…) highlighted by
  type, with a dialog that explains each one and lets the reader switch between the
  readings of an `<app>`, `<choice>` or `<subst>`. Readings that belong to the same
  variant group switch together.
- **Audio**: plays recorded audio synchronized with the score. Notes are coloured by staff
  and animated while they sound, a cursor travels along the system, and the score turns
  pages or scrolls along. A score can have several audio versions.
- **Facsimile**: images of the sources beside the score, with zoom and pan, one part at
  a time or all of them side by side. When the MEI links notes to zones of the images,
  the facsimile follows the music while it plays, beside the score or on its own tab,
  which then has the player buttons too. Ctrl+click (Cmd+click on macOS) on a
  note shows it on the other view, in either direction.
- **Texts**: an introduction in Markdown, and the poem and its notes from the MEI
  `<back>`.
- **Interface** in English and Spanish, tabs or a split view, and touch support.

Incompatible changes to the configuration, the MEI conventions and the API are listed in
[CHANGELOG.md](CHANGELOG.md).

## Installation

```bash
npm install score-viewer
```

React 19 (`react` and `react-dom`) is a peer dependency.

## Usage as a React component

```tsx
import { useRef } from 'react';
import ScoreViewer, { ScoreViewerConfig, ScoreViewerRef } from 'score-viewer';
import 'score-viewer/style.css';

const config: ScoreViewerConfig = {
  settings: {
    basePath: "/scores/",
    facsimileImagesPath: "/facsimile/",
    showScoreSelector: true,
    showTitle: false,
    showDownloadButton: true,
    showIntroductionSection: true,
    showTextSection: true,
    showFacsimileSection: true,
    showOptions: true,
    renderTitlesFromMEI: true,
    allowUserLanguageChange: true,
    language: "autodetect",
  },
  scores: [
    {
      title: "Un imposible me mata",
      path: "un-imposible",
      meiFile: "music.mei",
      introductionFile: "intro.md",
      audioFiles: [{ file: "un-imposible.mp3", name: "Recording" }],
      facsimileItems: [{ name: "Soprano 1", file: "un-imposible-s1.jpg" }],
      encodingProperties: { encodedTransposition: "-P4" },
    },
  ],
};

function App() {
  const viewer = useRef<ScoreViewerRef>(null);
  return <ScoreViewer ref={viewer} config={config} width="100%" height="100vh" />;
}
```

### Props

| Prop | Type | |
|---|---|---|
| `config` | `ScoreViewerConfig` | Required. See [Configuration](#configuration). |
| `width`, `height` | `string` | Required. Any CSS length. |
| `onScoreAnalyzed` | `(scoreIndex, properties: ScoreProperties) => void` | Called once a score is loaded, with what was read from its MEI: sections, sources, parts, editorial features… |
| `onVisualizationOptionsChanged` | `(options: VisualizationOptions) => void` | Called when the reader changes options the host may want to reflect, such as the original clefs. |

### Ref

| Method | |
|---|---|
| `goToSection(sectionId)` | Turns to the page where a `<section>` of the current score starts, by its `xml:id`. |
| `selectScore(index \| null)` | Loads the score at that index of `config.scores`, or unloads the current one with `null`. Useful with `showScoreSelector: false` and a selector of your own. |

### Usage with Vite

Exclude `score-viewer` from dependency optimization, so the verovio worker it ships is
loaded correctly:

```ts
export default defineConfig({
  optimizeDeps: {
    exclude: ['score-viewer'],
  },
});
```

### Limitations

- Only one viewer per page: the state is shared between instances, and the reader's
  options are stored in `localStorage`.
- Supported browsers are Chrome/Edge 87+, Firefox 78+ and Safari 14+. Some highlights of
  the editorial layer need `:has()` (Firefox 121+).

## Configuration

### Where files are read from

- MEI, audio and introduction: `basePath + score.path + "/" + file`.
- Facsimile images: `facsimileImagesPath + facsimileItems[].file`.

### `settings`

| Key | Type | |
|---|---|---|
| `basePath` | `string` | Required. Prefix of every score folder. |
| `facsimileImagesPath` | `string` | Required. Folder of the facsimile images. |
| `showScoreSelector` | `boolean` | Required. Shows the selector of the scores in `scores`. |
| `showTitle` | `boolean` | Required. Shows the title of the current score above it. |
| `showDownloadButton` | `boolean` | Required. Offers the MEI file for download in the score information dialog. |
| `showIntroductionSection` | `boolean` | Required. Shows the introduction of the scores that have one. |
| `showTextSection` | `boolean` | Required. Shows the poem read from the MEI `<back>`. |
| `showFacsimileSection` | `boolean` | Required. Shows the facsimile of the scores that have images. |
| `showOptions` | `boolean` | Required. Shows the options panel. |
| `renderTitlesFromMEI` | `boolean` | Required. Draws the `@label` of each `<section>` above it when a score has several. |
| `allowUserLanguageChange` | `boolean` | Required. Lets the reader change the language in the options panel. |
| `language` | `string` | `"en"`, `"es"` or `"autodetect"` (the browser language). The reader's own choice, if allowed, takes precedence. |
| `backgroundColor` | `string` | CSS colour behind the score. White by default. |
| `selectorLabel` | `"work" \| "section"` | What the score selector calls its entries. `"work"` by default. |
| `initialTab` | `"intro" \| "text" \| "music" \| "facsimile"` | The tab shown first, until the reader picks one. The music by default, and also when the score has no such tab. |

### `scores[]`

| Key | Type | |
|---|---|---|
| `title` | `string` | Required. Name in the score selector. |
| `path` | `string` | Required. Folder of the score under `basePath`. |
| `meiFile` | `string` | Required. The MEI file in that folder. |
| `encodingProperties` | `{ encodedTransposition?: string }` | Required, may be empty. `encodedTransposition` is the transposition the score was encoded with (`"-P4"`, `"+M3"`, `"P8"`…), which the reader can undo. |
| `audioFiles` | `{ file: string, name?: string }[]` | Audio versions of the score. The first one plays by default; with more than one, the reader can switch between them. |
| `introductionFile` | `string` | Markdown introduction. It must be served as `text/markdown` or `text/plain`. Image paths starting with `./` or `../` are resolved against the Markdown file; other relative paths, against the site root. |
| `facsimileItems` | `{ name: string, file: string, part?: string }[]` | Facsimile images. `part` is the `xml:id` of the `<perfRes>` whose part the image shows; without it, the image is taken for the full score. |

`text` and `textCommentsFile` are deprecated and ignored: the poem and its notes are read
from the MEI `<back>`.

## MEI conventions

Most of the MEI is rendered as verovio renders it. The viewer reads some extra
conventions: editorial accidentals, variant groups in `<classDecls>`, links to the
facsimile through `@facs`, parts through `<perfRes>` and `<staffDef @decls>`, and the
poem in `<back>`. They are documented, with examples, in [CHANGELOG.md](CHANGELOG.md).

Repeats are not expanded: the audio is expected to play the score straight through, as
verovio times it.

## Embedding with an iframe

`npm run build:iframe` builds a standalone page into `dist/iframe/`. The page is
`iframe/index.html` inside it, and it loads the configuration from the JSON file named in
its `config` query parameter:

```html
<iframe
  src="https://example.com/score-viewer/iframe/index.html?config=https://example.com/scores/config.json"
  style="width: 100%; height: 600px; border: none;"
  allow="autoplay; fullscreen"
  loading="lazy">
</iframe>
```

A relative `basePath` or `facsimileImagesPath` in that file is resolved against the
folder of the file itself; one that starts with `/` or `http` is used as it is.

### Hugo shortcode

`layouts/shortcodes/score-viewer.html`:

```html
{{ $height := .Get "height" | default "600px" }}
<iframe
  src="{{ "score-viewer/iframe/index.html" | relURL }}?config={{ .Get "config" | absURL }}"
  style="width: 100%; height: {{ $height }}; border: none;"
  allow="autoplay; fullscreen"
  loading="lazy">
</iframe>
```

```markdown
{{< score-viewer config="scores/config.json" height="700px" >}}
```

## Development

```bash
npm run dev            # development server with the test scores in test-fixtures/
npm run dev:iframe     # the iframe page
npm run build          # validates the test MEI files, type-checks and builds the library
npm run build:iframe   # builds the iframe page
npm run build:all      # both
npm run lint
npm run validate:mei   # validates the test MEI files against MEI 5.1 (validate:mei:schematron adds the Schematron rules)
```

The development server serves `test-fixtures/` at its root, with the configuration in
`assets/test.json`.

## License

MIT
