import "../entry-common"

import persist from "@alpinejs/persist"
import Alpine from "alpinejs"
import * as toaster from "x-toaster"
import calculator from "./calculator"

toaster.init({
	removeDelay: 200,
	gap: 12,
	maxToasts: 5,
	reverse: true,
})

Alpine.plugin(persist)
Alpine.data("calculator", calculator)
Alpine.start()
