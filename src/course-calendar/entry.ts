import '../entry-common'

import persist from '@alpinejs/persist'
import Alpine from 'alpinejs'
import * as toaster from 'x-toaster'
import generator from './generator'

toaster.init({
  removeDelay: 200,
  gap: 12,
  maxToasts: 5,
  reverse: true,
})

Alpine.plugin(persist)
Alpine.data('generator', generator)
Alpine.start()
