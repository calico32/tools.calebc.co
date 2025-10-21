declare module 'vite-plugin-handlebars' {
  import type { Plugin } from 'vite'

  interface Config {
    context?: Record<string, any> | ((pagePath: string) => Record<string, any>)
    partialDirectory?: string
    helpers?: Record<string, (value: unknown) => unknown>
  }

  function handlebars(config: Config): Plugin[]

  export default handlebars
}
