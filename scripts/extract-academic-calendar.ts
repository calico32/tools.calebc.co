import { UTCDate } from "@date-fns/utc"
import { JSDOM } from "jsdom"

import type { AcademicCalendar } from "../src/course-calendar/data"
import type { CalendarTerm } from "../src/course-calendar/types"

const url = process.argv[2]

if (!url) {
	console.error(`Usage: ${process.argv0} extract-academic-calendar.ts <url>`)
	process.exit(1)
}

if (!url.startsWith("https://www.wpi.edu/academics/calendar")) {
	console.error(`URL must start with "https://www.wpi.edu/academics/calendar"`)
	process.exit(1)
}

const response = await fetch(url)
if (!response.ok) {
	console.error(`Failed to fetch calendar: ${response.status} ${response.statusText}`)
	process.exit(1)
}

const dom = new JSDOM(await response.text())
const document = dom.window.document

function $(name: string, selector: string): Element {
	const el = document.querySelector(selector)
	if (!el) {
		throw new Error(`Failed to find ${name} element with selector "${selector}"`)
	}
	return el
}

function $all(name: string, selector: string): Element[] {
	const els = Array.from(document.querySelectorAll(selector))
	if (els.length === 0) {
		throw new Error(`Failed to find any ${name} elements with selector "${selector}"`)
	}
	return els
}

function parseSemester(lines: string[], year: number): CalendarTerm[] {
	let currentMonth = -1
	let currentDay = -1
	let currentDayRangeEnd = -1
	let currentTerm: CalendarTerm | null = null
	const terms: CalendarTerm[] = []

	const months = [
		"",
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	]
	const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

	const termStartPattern = /^first day of ([A-D])-term/i
	const termEndPattern = /^last day of ([A-D])-term/i
	const eTermStartPattern = /^summer session (II?).+?begin/i
	const eTermEndPattern = /^last day of summer session (II?)/i
	const followPattern = /^follow (.+) schedule$/i
	const noClassPattern = /^(.+?); no classes$|^no classes \((.+?)\)$/i
	const readingDayPattern = /^reading day/i

	const ignoredLines: string[] = []

	for (const line of lines) {
		const newMonth = months.indexOf(line)
		if (newMonth !== -1) {
			currentMonth = newMonth
			console.debug(`${line}`)
			continue
		}

		const newDay = /^\d{1,2}$/.test(line) ? parseInt(line, 10) : NaN
		if (!isNaN(newDay)) {
			if (
				currentTerm &&
				currentTerm.end &&
				new UTCDate(currentTerm.end).getDay() === currentDay
			) {
				// last term just ended
				currentTerm = null
			}

			currentDay = newDay
			currentDayRangeEnd = -1
			console.debug(`  ${line}`)
			continue
		}

		const dayRangeMatch = line.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/)
		if (dayRangeMatch) {
			currentDay = parseInt(dayRangeMatch[1], 10)
			currentDayRangeEnd = parseInt(dayRangeMatch[2], 10)
			console.debug(`  ${line} -> day range ${currentDay}-${currentDayRangeEnd}`)
			continue
		}

		const termStartMatch = line.match(termStartPattern)
		if (termStartMatch) {
			const term = termStartMatch[1]
			if (currentMonth === -1 || currentDay === -1) {
				throw new Error(`Found term start for term ${term} but month/day not set yet`)
			}
			if (currentDayRangeEnd !== -1) {
				throw new Error(
					`Found term start for term ${term} but day range is set (not supported)`,
				)
			}
			const date = new UTCDate(year, currentMonth - 1, currentDay)
			currentTerm = {
				id: `${term}${(year % 100).toString().padStart(2, "0")}`,
				start: date.toISOString().slice(0, 10),
				end: "",
				courses: [],
				dates: [],
			}
			terms.push(currentTerm)
			console.debug(
				`    ${line} -> start of term ${currentTerm.id} on ${date.toISOString().slice(0, 10)}`,
			)
			continue
		}

		const termEndMatch = line.match(termEndPattern)
		if (termEndMatch) {
			const term = termEndMatch[1]
			if (currentMonth === -1 || currentDay === -1) {
				throw new Error(`Found term end for term ${term} but month/day not set yet`)
			}
			if (currentDayRangeEnd !== -1) {
				throw new Error(
					`Found term end for term ${term} but day range is set (not supported)`,
				)
			}
			const date = new UTCDate(year, currentMonth - 1, currentDay)
			if (
				!currentTerm ||
				currentTerm.id !== `${term}${(year % 100).toString().padStart(2, "0")}`
			) {
				throw new Error(
					`Found term end for term ${term} but current term is ${currentTerm?.id}`,
				)
			}
			currentTerm.end = date.toISOString().slice(0, 10)
			console.debug(
				`    ${line} -> end of term ${currentTerm.id} on ${date.toISOString().slice(0, 10)}`,
			)
			continue
		}

		const eTermStartMatch = line.match(eTermStartPattern)
		if (eTermStartMatch) {
			const term = eTermStartMatch[1] === "I" ? "E1" : "E2"
			if (currentMonth === -1 || currentDay === -1) {
				throw new Error(`Found e-term start for term ${term} but month/day not set yet`)
			}
			if (currentDayRangeEnd !== -1) {
				throw new Error(
					`Found e-term start for term ${term} but day range is set (not supported)`,
				)
			}
			const date = new UTCDate(year, currentMonth - 1, currentDay)
			currentTerm = {
				id: term,
				start: date.toISOString().slice(0, 10),
				end: "",
				courses: [],
				dates: [],
			}
			terms.push(currentTerm)
			console.debug(
				`    ${line} -> start of e-term ${currentTerm.id} on ${date.toISOString().slice(0, 10)}`,
			)
			continue
		}

		const eTermEndMatch = line.match(eTermEndPattern)
		if (eTermEndMatch) {
			const term = eTermEndMatch[1] === "I" ? "E1" : "E2"
			if (currentMonth === -1 || currentDay === -1) {
				throw new Error(`Found e-term end for term ${term} but month/day not set yet`)
			}
			if (currentDayRangeEnd !== -1) {
				throw new Error(
					`Found e-term end for term ${term} but day range is set (not supported)`,
				)
			}
			const date = new UTCDate(year, currentMonth - 1, currentDay)
			if (!currentTerm || currentTerm.id !== term) {
				throw new Error(
					`Found e-term end for term ${term} but current term is ${currentTerm?.id}`,
				)
			}
			currentTerm.end = date.toISOString().slice(0, 10)
			console.debug(
				`    ${line} -> end of e-term ${currentTerm.id} on ${date.toISOString().slice(0, 10)}`,
			)
			currentTerm = null
			continue
		}

		const followMatch = line.match(followPattern)
		if (followMatch) {
			const weekday = followMatch[1]
			if (!weekdays.includes(weekday)) {
				throw new Error(
					`Found follow schedule for weekday "${weekday}" but it's not a valid weekday`,
				)
			}
			if (currentMonth === -1 || currentDay === -1) {
				throw new Error(`Found follow schedule for ${weekday} but month/day not set yet`)
			}
			if (currentDayRangeEnd !== -1) {
				throw new Error(
					`Found follow schedule for ${weekday} but day range is set (not supported)`,
				)
			}
			const date = new UTCDate(year, currentMonth - 1, currentDay)
			if (!currentTerm) {
				throw new Error(`Found follow schedule for ${weekday} but no current term is set`)
			}
			currentTerm.dates.push({
				date: date.toISOString().slice(0, 10),
				type: "follow",
				weekday: weekdays.indexOf(weekday) as any,
			})
			console.debug(
				`    ${line} -> follow ${weekday} schedule on ${date.toISOString().slice(0, 10)}`,
			)
			continue
		}

		const noClassMatch = line.match(noClassPattern)
		const readingDayMatch = line.match(readingDayPattern)
		if (noClassMatch || readingDayMatch) {
			const reason = noClassMatch?.[1] || noClassMatch?.[2] || "Reading Day"
			if (currentMonth === -1 || currentDay === -1) {
				throw new Error(
					`Found no-class day for reason "${reason}" but month/day not set yet`,
				)
			}
			if (currentDayRangeEnd === -1) {
				const date = new UTCDate(year, currentMonth - 1, currentDay)
				if (!currentTerm) {
					throw new Error(
						`Found no-class day for reason "${reason}" but no current term is set`,
					)
				}
				currentTerm.dates.push({
					date: date.toISOString().slice(0, 10),
					type: "no-class",
					reason,
				})
				console.debug(
					`    ${line} -> no class on ${date.toISOString().slice(0, 10)} due to ${reason}`,
				)
			} else {
				for (let day = currentDay; day <= currentDayRangeEnd; day++) {
					const date = new UTCDate(year, currentMonth - 1, day)
					if (!currentTerm) {
						throw new Error(
							`Found no-class day for reason "${reason}" but no current term is set`,
						)
					}
					currentTerm.dates.push({
						date: date.toISOString().slice(0, 10),
						type: "no-class",
						reason,
					})
					console.debug(
						`    ${line} -> no class on ${date.toISOString().slice(0, 10)} due to ${reason}`,
					)
				}
			}
			continue
		}

		ignoredLines.push(line)
	}

	console.warn(`Ignored lines:\n${ignoredLines.map((l) => `  ${l}`).join("\n")}`)

	if (currentTerm && !currentTerm.end) {
		throw new Error(`Term ${currentTerm.id} was not closed properly (missing end date)`)
	}

	return terms
}

async function main() {
	const calendar: AcademicCalendar = {
		name: "",
		year: [0, 0],
		range: ["", ""],
		terms: [],
	}

	const eTerm: AcademicCalendar = {
		name: "",
		year: [0, 0],
		range: ["", ""],
		terms: [],
	}

	const title = $("calendar title", "h2.anchors__title").textContent
	const match = title?.match(/(\d{4})\s*-\s*(\d{4})/)
	if (!match) {
		throw new Error(`Failed to parse academic year from title "${title}"`)
	}
	const yearStart = parseInt(match[1], 10)
	const yearEnd = parseInt(match[2], 10)

	calendar.name = `WPI AY ${yearStart}-${yearEnd}`
	calendar.year = [yearStart, yearEnd]
	eTerm.name = `WPI E-Term AY ${yearEnd}`
	eTerm.year = [yearEnd, yearEnd]

	const semesters = $all("semester", "div.body-widget > h2")
	if (semesters.length !== 3) {
		throw new Error(
			`Expected 3 semesters (fall, spring, summer), found ${semesters.length} (${semesters.map((s) => JSON.stringify(s.textContent)).join(", ")})`,
		)
	}

	const fall = getSemesterText(semesters[0].parentElement)
	if (!fall) {
		throw new Error(`Failed to find fall semester element`)
	}

	const spring = getSemesterText(semesters[1].parentElement)
	if (!spring) {
		throw new Error(`Failed to find spring semester element`)
	}

	const summer = getSemesterText(semesters[2].parentElement)
	if (!summer) {
		throw new Error(`Failed to find summer semester element`)
	}

	calendar.terms.push(...parseSemester(fall, yearStart))
	if (calendar.terms.length !== 2) {
		throw new Error(
			`Expected 2 terms (A, B), found ${calendar.terms.length} (${calendar.terms.map((t) => t.id).join(", ")})`,
		)
	}
	calendar.terms.push(
		createSemesterTerm(
			calendar.terms[0],
			calendar.terms[1],
			`F${(yearStart % 100).toString().padStart(2, "0")}`,
		),
	)

	calendar.terms.push(...parseSemester(spring, yearEnd))
	if ((calendar.terms.length as number) !== 5) {
		throw new Error(
			`Expected 5 terms (A, B, F, C, D), found ${calendar.terms.length} (${calendar.terms.map((t) => t.id).join(", ")})`,
		)
	}
	calendar.terms.push(
		createSemesterTerm(
			calendar.terms[3],
			calendar.terms[4],
			`S${(yearEnd % 100).toString().padStart(2, "0")}`,
		),
	)

	eTerm.terms.push(...parseSemester(summer, yearEnd))
	if (eTerm.terms.length !== 2) {
		throw new Error(
			`Expected 2 e-terms (E1, E2), found ${eTerm.terms.length} (${eTerm.terms.map((t) => t.id).join(", ")})`,
		)
	}

	calendar.range = [calendar.terms[0].start, calendar.terms[calendar.terms.length - 1].end]
	eTerm.range = [eTerm.terms[0].start, eTerm.terms[eTerm.terms.length - 1].end]

	console.log(JSON.stringify(calendar, null, 2))
	console.log(JSON.stringify(eTerm, null, 2))
}

function createSemesterTerm(a: CalendarTerm, b: CalendarTerm, id: string): CalendarTerm {
	const breakStart = new UTCDate(a.end)
	breakStart.setDate(breakStart.getDate() + 1)
	const breakEnd = new UTCDate(b.start)
	const breakDates: CalendarTerm["dates"] = []
	for (let d = breakStart; d.getTime() < breakEnd.getTime(); d.setDate(d.getDate() + 1)) {
		breakDates.push({
			date: d.toISOString().slice(0, 10),
			type: "no-class",
			reason: "Break",
			hidden: true,
		})
	}
	return {
		id: id,
		start: a.start,
		end: b.end,
		courses: [],
		dates: [...a.dates, ...breakDates, ...b.dates],
	}
}

function getSemesterText(semesterEl: Element | null): string[] | undefined {
	return semesterEl
		?.querySelector(".content-body")
		?.textContent.split("\n")
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
}

await main()
