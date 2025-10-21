import type {
  $persist,
  InferInterceptors,
  Magics,
  XDataContext,
} from 'alpinejs'

import Alpine from 'alpinejs'

declare global {
  interface Window {
    Alpine: typeof Alpine
  }
}

/**
 * Persist\<T> represents a type that is persisted in local storage.
 */
export type Persist<T> = ReturnType<typeof $persist<T>>

/**
 * AlpineThis\<T> represents the type of `this` within `Alpine.data`.
 */
export type AlpineThis<T> = InferInterceptors<T> & XDataContext & Magics<T>
