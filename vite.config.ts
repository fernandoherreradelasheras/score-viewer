import { defineConfig, esmExternalRequirePlugin } from 'vite'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { dirname, resolve } from 'node:path'
import svgr from "vite-plugin-svgr";

const __dirname = dirname(fileURLToPath(import.meta.url))

const external = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client']

export default defineConfig(({ mode }) => {
  const isIframeMode = mode === 'iframe';
  const isDev = mode === 'development' || process.env.NODE_ENV === 'development';

  // Base configuration shared between all modes
  const config = {
    plugins: [
      react({
        // Enable better error reporting and component stack traces in development
        //fastRefresh: true,
        jsxRuntime: 'automatic'
      }),
      dts({
        bundleTypes: true,
        insertTypesEntry: true,
        staticImport: true,
        include: ['lib/**/*', 'src/**/*'],
        outDirs: 'dist/types'
      }),
      svgr({ svgrOptions: { icon: false } })
    ],
    // Test fixtures served at the dev-server root by `npm run dev`.
    // The are not copied into the build output (as set by build.copyPublicDir
    // below) so they don't leak into the npm package with the component.
    publicDir: 'test-fixtures',
    build: {
      // Enable source maps for better debugging
      sourcemap: true,
      minify: !isDev,
      copyPublicDir: false,
      // What Vite 5 built for by default. Vite 8 follows the browser baseline
      // instead, which moves forward on its own and would silently drop browsers
      // this component still supports, both here and in the generated CSS.
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    },
    // Enable detailed source maps in development
    css: {
      devSourcemap: true,
    },
    // Configure error overlay
    server: {
      hmr: true,
    },
  };

  if (isIframeMode) {
    // Build configuration for standalone iframe version
    return {
      ...config,
      base: "./",
      build: {
        ...config.build,
        outDir: 'dist/iframe',
        target: 'es2015',
        minify: isDev ? false : 'oxc',
        rolldownOptions: {
          input: {
            main: resolve(__dirname, 'iframe/index.html'),
          },
          output: {
            manualChunks: undefined,
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
          },
        },
      },
    };
  } else {
    // Build configuration for library mode
    return {
      ...config,
      // Rolldown no longer rewrites require() of external modules inside
      // bundled CommonJS dependencies into imports on its own, and leaves a
      // require() call that fails in the browser.
      plugins: [...config.plugins, esmExternalRequirePlugin({ external })],
      base: './',
      build: {
        ...config.build,
        lib: {
          entry: resolve(__dirname, 'lib/main.ts'),
          name: 'ScoreViewer',
          fileName: 'score-viewer',
          formats: ['es', 'umd'],
        },
        rolldownOptions: {
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
              'react-dom/client': 'ReactDOMClient',
              'react/jsx-runtime': 'jsxRuntime'
            },
            // Explicitly name the CSS file as 'style.css' to match package.json exports
            assetFileNames: (assetInfo) => {
              if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'style.css';
              return assetInfo.name || 'assets/[name]-[hash][extname]';
            },
          },
        },
        // Ensure CSS is extracted to a separate file
        cssCodeSplit: false,
      },
    };
  }
})
