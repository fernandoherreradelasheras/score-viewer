# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```

# Score Viewer Component

A React component for viewing and playing musical scores in MEI format with synchronized audio playback.

## Installation and Usage

### As a React Component

```bash
npm install score-viewer
# or
yarn add score-viewer
```

```jsx
import { ScoreViewer } from 'score-viewer';
import 'score-viewer/style.css'; // Import styles

// Option 1: Pass config as a prop
const config = {
  settings: {
    renderTitlesFromMEI: true,
    showScoreSelector: true,
    backgroundColor: "#f6eee3"
  },
  scores: [
    {
      title: "Example Score",
      audioUrl: "/path/to/audio.mp3",
      meiUrl: "/path/to/score.mei",
      encodingProperties: {
        encodedTransposition: null
      }
    }
  ]
};

function App() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ScoreViewer config={config} />
    </div>
  );
}
```

### Usage with Vite

If you are using Vite, you must exclude `score-viewer` from dependency optimization to ensure the Verovio worker is loaded correctly. Add this to your `vite.config.ts`:

```typescript
export default defineConfig({
  // ...
  optimizeDeps: {
    exclude: ['score-viewer']
  }
})
```

This is necessary because `score-viewer` uses a web worker that references external assets, which can be mishandled by Vite's dependency pre-bundling. Excluding it from optimization ensures the worker is loaded correctly without impacting performance.

### As an Iframe in Hugo or other static sites

You can embed the Score Viewer in any static site using an iframe. This is perfect for Hugo sites or any non-React web environment.

#### Hugo Shortcode Example

Create a new shortcode in your Hugo site at `layouts/shortcodes/score-viewer.html`:

```html
{{ $configJSON := .Get "config" | jsonify }}
{{ $encodedConfig := $configJSON | urlquery }}
{{ $height := .Get "height" | default "500px" }}
{{ $width := .Get "width" | default "100%" }}

<iframe
  src="{{ .Site.BaseURL }}score-viewer/iframe/?config={{ $encodedConfig }}"
  style="width: {{ $width }}; height: {{ $height }}; border: none;"
  allow="autoplay"
  loading="lazy">
</iframe>
```

Then use it in your Markdown content:

```markdown
{{< score-viewer
  height="600px"
  config='{
    "settings": {
      "renderTitlesFromMEI": true,
      "showScoreSelector": true,
      "backgroundColor": "#f6eee3"
    },
    "scores": [
      {
        "title": "Example Score",
        "audioUrl": "/scores/example.mp3",
        "meiUrl": "/scores/example.mei",
        "encodingProperties": {
          "encodedTransposition": null
        }
      }
    ]
  }'
>}}
```

#### Plain HTML Embedding

For any other static site or CMS:

```html
<iframe
  src="https://your-cdn-or-server.com/score-viewer/iframe/?config=%7B%22settings%22%3A%7B%22renderTitlesFromMEI%22%3Atrue%2C%22showScoreSelector%22%3Atrue%2C%22backgroundColor%22%3A%22%23f6eee3%22%7D%2C%22scores%22%3A%5B%7B%22title%22%3A%22Example%20Score%22%2C%22audioUrl%22%3A%22%2Fscores%2Fexample.mp3%22%2C%22meiUrl%22%3A%22%2Fscores%2Fexample.mei%22%2C%22encodingProperties%22%3A%7B%22encodedTransposition%22%3Anull%7D%7D%5D%7D"
  style="width: 100%; height: 500px; border: none;"
  allow="autoplay"
  loading="lazy">
</iframe>
```

Or create the config dynamically:

```html
<script>
  function createScoreViewerIframe(config, container) {
    const encodedConfig = encodeURIComponent(JSON.stringify(config));
    const iframe = document.createElement('iframe');
    iframe.src = `https://your-cdn-or-server.com/score-viewer/iframe/?config=${encodedConfig}`;
    iframe.style.width = '100%';
    iframe.style.height = '500px';
    iframe.style.border = 'none';
    iframe.setAttribute('allow', 'autoplay');
    iframe.setAttribute('loading', 'lazy');
    document.getElementById(container).appendChild(iframe);
  }

  // Example usage
  createScoreViewerIframe({
    settings: {
      renderTitlesFromMEI: true,
      showScoreSelector: true,
      backgroundColor: "#f6eee3"
    },
    scores: [
      {
        title: "Example Score",
        audioUrl: "/scores/example.mp3",
        meiUrl: "/scores/example.mei",
        encodingProperties: {
          encodedTransposition: null
        }
      }
    ]
  }, 'score-container');
</script>
<div id="score-container"></div>
```

## Development

```bash
# Run development server for component library
npm run dev

# Run development server for iframe version
npm run dev:iframe

# Build component library
npm run build

# Build iframe version
npm run build:iframe

# Build both versions
npm run build:all
```

## Configuration Options

The `ScoreViewer` accepts a config object with the following structure:

```typescript
interface ScoreViewerConfig {
  settings: {
    showScoreSelector: boolean, // Whether to show the score selector dropdown
    renderTitlesFromMEI: boolean, // Extract and render titles from MEI file
    backgroundColor?: string // Optional background color for the score
  },
  scores: {
    title: string, // Title of the score
    audioUrl?: string, // Optional URL to audio file for playback
    meiUrl: string, // URL to MEI file
    encodingProperties: {
      encodedTransposition?: string // Optional transposition value (e.g. "-P4")
    }
  }[]
}
```

## License

MIT
