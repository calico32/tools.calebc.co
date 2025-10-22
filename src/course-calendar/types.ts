import { UTCDate } from '@date-fns/utc'
import { formatDate, parse } from 'date-fns'

export const Weekday = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
} as const
export type Weekday = (typeof Weekday)[keyof typeof Weekday]
export function parseWeekday(weekday: string): Weekday | Error {
  return (
    {
      sunday: Weekday.Sunday,
      monday: Weekday.Monday,
      tuesday: Weekday.Tuesday,
      wednesday: Weekday.Wednesday,
      thursday: Weekday.Thursday,
      friday: Weekday.Friday,
      saturday: Weekday.Saturday,
      su: Weekday.Sunday,
      m: Weekday.Monday,
      t: Weekday.Tuesday,
      w: Weekday.Wednesday,
      r: Weekday.Thursday,
      f: Weekday.Friday,
      sa: Weekday.Saturday,
    }[weekday.toLowerCase().trim()] ?? new Error(`invalid weekday ${weekday}`)
  )
}
export function weekdayToString(weekday: Weekday, short = false): string {
  if (short) {
    return ['Su', 'M', 'T', 'W', 'R', 'F', 'Sa'][weekday]
  }
  return [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][weekday]
}

export interface MeetingPattern {
  startTime: string
  endTime: string
  weekdays: Weekday[]
  location: string | null
}

export function emptyMeetingPattern(): MeetingPattern {
  return {
    startTime: '',
    endTime: '',
    weekdays: [],
    location: null,
  }
}

export function isEmptyMeetingPattern(mp: MeetingPattern): boolean {
  return !mp.weekdays.length && !mp.startTime && !mp.endTime && !mp.location
}

export function parseMeetingPattern(pattern: string): MeetingPattern | Error {
  const parts = pattern.split('|')
  if (parts.length !== 2 && parts.length !== 3) {
    return new Error(
      `scanning MeetingPattern: expected two parts separated by '|', got ${parts.length}`
    )
  }
  const weekdays: Weekday[] = []
  const weekdayStrings = parts[0].split('-')
  for (const w of weekdayStrings) {
    const weekday = parseWeekday(w)
    if (weekday instanceof Error) {
      return new Error(`scanning MeetingPattern: invalid weekday ${w}`)
    }
    if (weekdays.includes(weekday)) {
      return new Error(`scanning MeetingPattern: weekday ${w} is duplicated`)
    }
    weekdays.push(weekday)
  }
  const times = parts[1].split('-')
  if (times.length !== 2) {
    return new Error(
      `scanning MeetingPattern: expected two times, got ${times.length}`
    )
  }
  const startTime = parseTime(times[0])
  const endTime = parseTime(times[1])
  if (startTime instanceof Error || endTime instanceof Error) {
    return new Error(
      `scanning MeetingPattern: failed to parse time: ${startTime} ${endTime}`
    )
  }
  if (startTime > endTime) {
    return new Error(
      `scanning MeetingPattern: start time ${times[0]} after end time ${times[1]}`
    )
  }
  return {
    startTime,
    endTime,
    weekdays,
    location: parts[2]?.trim() ?? null,
  }
}

function parseTime(time: string): string | Error {
  try {
    const t = parse(time.trim(), 'hh:mm a', new UTCDate('2025-01-01 00:00:00'))
    return formatDate(t, 'HH:mm')
  } catch (e) {
    return new Error(String(e))
  }
}

export interface Calendar {
  name: string
  terms: CalendarTerm[]
}

export interface CalendarTerm {
  id: string
  start: string
  end: string
  courses: CalendarCourse[]
  dates: CalendarDate[]
}

export interface CalendarSection {
  name: string
  meetingPatterns: MeetingPattern[]
  except: string[]
}

export interface CalendarCourse {
  number: string
  name: string
  meetingPatterns: MeetingPattern[]
  except: string[]
  subsections: CalendarSection[]
}

export type CalendarDate = { date: string } & (
  | { type: 'no-class'; reason?: string; hidden?: boolean }
  | { type: 'follow'; weekday: Weekday }
)
