// import { registerSW } from 'virtual:pwa-register'

// let alpineReady = new Promise<void>((resolve) => {
//   document.addEventListener(
//     'alpine:initialized',
//     () => {
//       resolve()
//     },
//     { once: true }
//   )
// })

// registerSW({
//   immediate: true,
//   onRegisteredSW(swUrl, r) {
//     if (!r) return
//     setInterval(async () => {
//       if (r.installing || !navigator) return
//       if ('connection' in navigator && !navigator.onLine) return

//       const resp = await fetch(swUrl, {
//         cache: 'no-store',
//         headers: {
//           cache: 'no-store',
//           'cache-control': 'no-cache',
//         },
//       })

//       if (resp?.status === 200) {
//         await r.update()
//       }
//     }, 60 * 60 * 1000) // 1 hour
//   },
//   onRegisterError(error) {},
//   async onOfflineReady() {},
// })
