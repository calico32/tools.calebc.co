import { ay_2025_2026, ay_e2026 } from "./calendars/25-26"
import { ay_2026_2027, ay_e2027 } from "./calendars/26-27"
import { type CalendarTerm } from "./types"

export interface AcademicCalendar {
	name: string
	year: [number, number]
	range: [string, string]
	terms: CalendarTerm[]
}

export const academicCalendars = {
	"2025-2026": ay_2025_2026,
	"2026-E": ay_e2026,
	"2026-2027": ay_2026_2027,
	"2027-E": ay_e2027,
}

export const currentCalendar: keyof typeof academicCalendars = "2026-2027"
export const currentSummerCalendar: keyof typeof academicCalendars = "2027-E"
export const nextCalendar: keyof typeof academicCalendars | null = null
export const nextSummerCalendar: keyof typeof academicCalendars | null = null
