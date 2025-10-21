import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import url from 'node:url'
import { defineConfig } from 'vite'
import handlebars from 'vite-plugin-handlebars'
import inspect from 'vite-plugin-inspect'
// import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

// const icons = [
//   [64, 'any'],
//   [192, 'any'],
//   [512, 'any'],
//   [512, 'maskable'],
//   [512, 'monochrome'],
// ] as const

export default defineConfig({
  root: 'src',
  publicDir: '../assets',
  appType: 'mpa',
  plugins: [
    inspect(),
    tailwindcss(),
    handlebars({
      partialDirectory: path.resolve(__dirname, 'src/partials'),
    }),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   injectRegister: 'script-defer',
    //   manifest: {
    //     id: '/',
    //     name: 'tools.calebc.co',
    //     short_name: 'tools.calebc.co',
    //     description: 'tools.calebc.co',
    //     start_url: '/',
    //     display: 'standalone',
    //     background_color: '#ffffff',
    //     theme_color: '#ffffff',
    //     icons: icons.map(([size, purpose]) => ({
    //       type: 'image/png',
    //       purpose,
    //       sizes: `${size}x${size}`,
    //       src:
    //         purpose === 'maskable'
    //           ? `/icon/${size}-maskable.png`
    //           : `/icon/${size}.png`,
    //     })),
    //   },
    // }),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'src/index.html'),
        'course-calendar': path.resolve(
          __dirname,
          'src/course-calendar/index.html'
        ),
        notFound: path.resolve(__dirname, 'src/404.html'),
      },
    },
  },
  server: {
    allowedHosts: ['pangolin'],
  },
})
