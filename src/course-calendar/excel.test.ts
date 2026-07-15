import { expect, test } from "vitest"

import { isBookkeepingCourse } from "./excel.ts"

test("isBookkeepingCourse", () => {
	expect(isBookkeepingCourse("CS 4999")).toBe(true)
	expect(isBookkeepingCourse("BME 4999")).toBe(true)
	expect(isBookkeepingCourse("PC 1000")).toBe(true)
	expect(isBookkeepingCourse("CS 4998")).toBe(false)
	expect(isBookkeepingCourse("PC 1010")).toBe(false)
	expect(isBookkeepingCourse("CH 1010")).toBe(false)
})
