import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { dirname, resolve } from 'node:path'
import svgr from "vite-plugin-svgr";

const __dirname = dirname(fileURLToPath(import.meta.url))

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
        rollupTypes: true,
        insertTypesEntry: true,
        staticImport: true,
        include: ['lib/**/*', 'src/**/*'],
        outDir: 'dist/types'
      }),
      svgr({ svgrOptions: { icon: false } })
    ],
    // Enable source maps for better debugging
    build: {
      sourcemap: true,
      minify: !isDev,
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
        minify: isDev ? false : 'esbuild',
        rollupOptions: {
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
      base: './',
      build: {
        ...config.build,
        lib: {
          entry: resolve(__dirname, 'lib/main.ts'),
          name: 'ScoreViewer',
          fileName: 'score-viewer',
          formats: ['es', 'umd'],
        },
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM',
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
