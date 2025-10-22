import { UTCDate } from '@date-fns/utc'
import type { AlpineComponent } from 'alpinejs'
import { addDays, addMinutes, format as formatDate, isBefore } from 'date-fns'
import { type EventAttributes, createEvents } from 'ics'
import * as toaster from 'x-toaster'
import type { AlpineThis, Persist } from '../types'
import { academicCalendars } from './data'
import { parseExcelCalendar } from './excel'
import {
  type Calendar,
  type CalendarCourse,
  type CalendarDate,
  type CalendarSection,
  type CalendarTerm,
  type MeetingPattern,
  type Weekday,
  emptyMeetingPattern,
  isEmptyMeetingPattern,
  weekdayToString,
} from './types'
import { validate } from './validate'

export class Generator implements AlpineComponent<Generator> {
  calendar: Persist<Calendar>
  errors: string[] = []
  ical: string | null = null
  importWarnings: Persist<{ title: string; message: string }[]>
  generateWarnings: { title: string; message: string }[] = []

  constructor(alpine: AlpineThis<Generator>) {
    this.calendar = alpine.$persist({
      name: '',
      terms: [],
    })
    this.importWarnings = alpine.$persist([])
  }

  init(this: AlpineThis<Generator>): void {
    this.calendar.terms.sort((a, b) => a.start.localeCompare(b.start))
    for (const term of this.calendar.terms) {
      term.dates.sort((a, b) => a.date.localeCompare(b.date))
      for (const course of term.courses) {
        course.except.sort()
        for (const subsection of course.subsections) {
          subsection.except.sort()
        }
      }
    }
    this.$watch('calendar', () => {
      this.generateICal()
    })
    this.generateICal()
  }

  /** reset resets the calendar to its initial state. */
  reset(this: AlpineThis<Generator>): void {
    this.calendar = { name: '', terms: [] }
    this.importWarnings = []
    this.generateWarnings = []
    this.ical = null
    this.errors = []
  }

  /** addTerm adds an empty term to the calendar. */
  addTerm(this: AlpineThis<Generator>): void {
    this.calendar.terms.push({
      id: '',
      start: '',
      end: '',
      courses: [],
      dates: [],
    })
  }

  /** addDefaultTerms adds the default WPI AY terms to the calendar. */
  addDefaultTerms(this: AlpineThis<Generator>): void {
    this.calendar.terms.push(...academicCalendars['2025-2026'].terms)
  }

  /** addSummerTerms adds the default WPI E terms to the calendar. */
  addSummerTerms(this: AlpineThis<Generator>): void {
    this.calendar.terms.push(...academicCalendars['2026-E'].terms)
  }

  /** addCourse adds an empty course to the given term. */
  addCourse(this: AlpineThis<Generator>, term: CalendarTerm): void {
    term.courses.push({
      name: '',
      number: '',
      meetingPatterns: [emptyMeetingPattern()],
      except: [],
      subsections: [],
    })
  }

  /** addMeetingPattern adds an empty meeting pattern to the given course/subsection. */
  addMeetingPattern(
    this: AlpineThis<Generator>,
    component: CalendarCourse | CalendarSection
  ): void {
    component.meetingPatterns.push(emptyMeetingPattern())
  }

  /** addSpecialDate adds a special date to the given term. */
  addSpecialDate(this: AlpineThis<Generator>, term: CalendarTerm): void {
    term.dates.push({ date: '', type: 'no-class', reason: '' })
  }

  /** addSubsection adds an empty subsection to the given course. */
  addSubsection(this: AlpineThis<Generator>, course: CalendarCourse): void {
    course.subsections.push({
      name: '',
      meetingPatterns: [emptyMeetingPattern()],
      except: [],
    })
  }

  /** toggleWeekday toggles the weekday for the given meeting pattern. */
  toggleWeekday(
    this: AlpineThis<Generator>,
    weekday: Weekday,
    mp: MeetingPattern
  ): void {
    if (mp.weekdays.includes(weekday)) {
      mp.weekdays = mp.weekdays.filter((w) => w !== weekday)
    } else {
      mp.weekdays.push(weekday)
    }
  }

  /** addMinutes adds minutes to the given time string. */
  addMinutes(
    this: AlpineThis<Generator>,
    time: string,
    minutes: number
  ): string {
    if (!time) return '00:00'
    const t = addMinutes(new Date('2025-01-01 ' + time + ':00'), minutes)
    return formatDate(t, 'HH:mm')
  }

  /** weekdayToString converts a weekday to a string. */
  weekdayToString = weekdayToString

  /** generateICal generates an .ics file from the calendar and stores it. */
  async generateICal(this: AlpineThis<Generator>): Promise<void> {
    const { errors, warnings } = validate(this.calendar)
    if (errors.length) {
      this.errors = errors
      this.generateWarnings = warnings
      this.ical = null
      return
    }

    const events: EventAttributes[] = []
    let i = 0
    for (const term of this.calendar.terms) {
      const end = new UTCDate(term.end)
      outer: for (
        let d = new UTCDate(term.start);
        isBefore(d, addDays(end, 1));
        d = addDays(d, 1)
      ) {
        i++
        if (i > 1000) {
          this.errors.push('too many events')
          return
        }
        const uids = new Set<string>()
        let weekday = new UTCDate(d).getDay() as Weekday
        for (const special of term.dates) {
          if (special.date === formatDate(d, 'yyyy-MM-dd')) {
            if (special.type === 'no-class') {
              const uid = `course-calendar-${special.date}-no-class@tools.calebc.co`
              if (!uids.has(uid) && !special.hidden) {
                uids.add(uid)
                events.push({
                  uid,
                  start: toIcsDate(d),
                  end: toIcsDate(addDays(d, 1)),
                  title: special.reason
                    ? `No Classes (${special.reason})`
                    : 'No Classes',
                })
              }
              continue outer
            } else if (special.type === 'follow') {
              weekday = special.weekday
              const uid = `course-calendar-${special.date}-follow@tools.calebc.co`
              if (!uids.has(uid)) {
                uids.add(uid)
                events.push({
                  uid,
                  start: toIcsDate(d),
                  end: toIcsDate(addDays(d, 1)),
                  title: `Follow ${weekdayToString(weekday)} Schedule`,
                })
              }
              break
            }
          }
        }
        for (const course of term.courses) {
          for (const mp of course.meetingPatterns) {
            if (mp.weekdays.includes(weekday)) {
              events.push({
                uid: `course-calendar-${course.number.replaceAll(
                  ' ',
                  ''
                )}-${formatDate(d, 'yyyy-MM-dd')}@tools.calebc.co`,
                start: toIcsTime(d, mp.startTime),
                end: toIcsTime(d, mp.endTime),
                title: `${course.number} - ${course.name}`,
                location: mp.location || undefined,
              })
            }
          }
          for (const subsection of course.subsections) {
            for (const mp of subsection.meetingPatterns) {
              if (mp.weekdays.includes(weekday)) {
                events.push({
                  uid: `course-calendar-${course.number.replaceAll(
                    ' ',
                    ''
                  )}-${subsection.name.replaceAll(' ', '')}-${formatDate(
                    d,
                    'yyyy-MM-dd'
                  )}@tools.calebc.co`,
                  start: toIcsTime(d, mp.startTime),
                  end: toIcsTime(d, mp.endTime),
                  title: `${course.number} - ${course.name} (${subsection.name})`,
                  location: mp.location || undefined,
                })
              }
            }
          }
        }
      }
    }

    const calendarData = await encodeCalendar(this.calendar)
    if (calendarData instanceof Error) {
      this.errors.push(`Failed to encode calendar: ${calendarData.message}`)
      return
    }

    const { error, value } = createEvents(events, {
      calName: this.calendar.name.trim() || 'Course Calendar',
      productId: '-//tools.calebc.co//' + calendarData + '//EN',
    })
    if (error) {
      this.errors = [...this.errors, error.message]
      this.generateWarnings = warnings
      this.ical = null
    } else {
      this.errors = []
      this.generateWarnings = warnings
      this.ical = value!
    }
  }

  /** selectExcelFile prompts the user to select an Excel file. */
  selectExcelFile(this: AlpineThis<Generator>): void {
    // begin loading the xlsx library while the user selects the file
    import('xlsx')
    if (
      this.calendar.terms.length &&
      !confirm('Importing will reset the current calendar. Continue?')
    ) {
      return
    }
    this.$refs.excelInput.click()
  }

  /** selectIcsFile prompts the user to select an .ics file. */
  selectIcsFile(this: AlpineThis<Generator>): void {
    // begin loading the ical.js library while the user selects the file
    import('ical.js')
    if (
      this.calendar.terms.length &&
      !confirm('Importing will reset the current calendar. Continue?')
    ) {
      return
    }
    this.$refs.icsInput.click()
  }

  /** importExcel imports an Excel file into the calendar. */
  async importExcel(this: AlpineThis<Generator>): Promise<void> {
    const file = (this.$refs.excelInput as HTMLInputElement).files?.[0]
    if (!file) {
      toaster.show({
        message: 'No file selected.',
        class: 'error',
      })
      return
    }
    const loading = toaster.show({
      message: 'Parsing file (this might take a while)...',
      class: 'info',
      duration: -1,
    })
    const result = await parseExcelCalendar(await file.arrayBuffer())
    loading.hide()
    if (result.error) {
      toaster.show({
        title: 'Import failed',
        message: result.error.message,
        class: 'error',
      })
      return
    }
    this.calendar.terms.splice(0, this.calendar.terms.length)
    this.calendar.name = result.calendar.name
    this.calendar.terms.push(...result.calendar.terms)
    ;(this.$refs.excelInput as HTMLInputElement).value = ''
    if (!result.warnings.length) {
      toaster.show({
        title: 'Import succeeded',
        message: 'Review and make any necessary changes below.',
        class: 'success',
      })
    } else {
      toaster.show({
        title: 'Import succeeded with warnings',
        message: 'Review the warnings below and make any necessary changes.',
        class: 'warning',
        duration: 10000,
      })
      this.importWarnings.splice(0, this.importWarnings.length)
      this.importWarnings.push(...result.warnings)
    }
  }

  /** importIcs restores data from an .ics file into the editor. */
  async importIcs(this: AlpineThis<Generator>): Promise<void> {
    const { default: ical } = await import('ical.js')
    const file = (this.$refs.icsInput as HTMLInputElement).files?.[0]
    if (!file) {
      toaster.show({
        message: 'No file selected.',
        class: 'error',
      })
      return
    }
    const data = await file.text()
    let cal: unknown
    try {
      cal = ical.parse(data)
    } catch (e) {
      toaster.show({
        message: 'Invalid .ics file.',
        class: 'error',
      })
      return
    }
    if (
      !Array.isArray(cal) ||
      cal[0] !== 'vcalendar' ||
      !cal[1] ||
      !Array.isArray(cal[1])
    ) {
      toaster.show({
        message: 'Invalid .ics file.',
        class: 'error',
      })
      return
    }
    for (const [id, , , value] of cal[1]) {
      if (id === 'prodid') {
        const calendarData = await decodeConfig(value.split('//')[2])
        if (calendarData instanceof Error) {
          toaster.show({
            message: `Failed to decode calendar: ${calendarData.message}`,
            class: 'error',
          })
          return
        }
        this.calendar.terms.splice(0, this.calendar.terms.length)
        this.calendar.name = calendarData.name
        this.calendar.terms.push(...calendarData.terms)
        ;(this.$refs.icsInput as HTMLInputElement).value = ''
        toaster.show({
          message:
            'Restore succeeded. Review and make any necessary changes below.',
          class: 'success',
        })
        return
      }
    }

    ;(this.$refs.icsInput as HTMLInputElement).value = ''
    toaster.show({
      message:
        "Couldn't find calendar data in the .ics file. Please try again.",
      class: 'error',
    })
  }

  /** copyICal copies the current .ics file to the clipboard. */
  copyICal(this: AlpineThis<Generator>): void {
    navigator.clipboard.writeText(this.ical ?? '')
    toaster.show({
      message: 'Copied to clipboard.',
      class: 'success',
    })
  }

  /** downloadICal downloads the current .ics file. */
  downloadICal(this: AlpineThis<Generator>): void {
    const file = new Blob([this.ical ?? ''], {
      type: 'text/calendar',
    })
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = `${this.calendar.name}.ics`
    a.click()
    URL.revokeObjectURL(url)
    toaster.show({
      message: 'Download succeeded.',
      class: 'success',
    })
  }

  /** scrollToBottom scrolls the editor to the bottom. */
  scrollToBottom(this: AlpineThis<Generator>): void {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth',
    })
  }

  /** scrollToTop scrolls the editor to the top. */
  scrollToTop(this: AlpineThis<Generator>): void {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** dismissWarning dismisses a warning. */
  dismissWarning(this: AlpineThis<Generator>, index: number): void {
    this.importWarnings.splice(index, 1)
  }

  isEmptyTerm(term: CalendarTerm): boolean {
    return (
      !term.id &&
      !term.start &&
      !term.end &&
      (!term.courses.length || term.courses.every(this.isEmptyCourse))
    )
  }
  isEmptyCourse(course: CalendarCourse): boolean {
    return (
      !course.number &&
      !course.name &&
      (!course.meetingPatterns.length ||
        course.meetingPatterns.every(isEmptyMeetingPattern)) &&
      !course.subsections.length &&
      !course.except.length
    )
  }
  isEmptySubsection(subsection: CalendarSection): boolean {
    return (
      !subsection.name &&
      (!subsection.meetingPatterns.length ||
        subsection.meetingPatterns.every(isEmptyMeetingPattern)) &&
      !subsection.except.length
    )
  }
  isEmptyException(exception: string): boolean {
    return !exception
  }
  isEmptyDate(date: CalendarDate): boolean {
    return (
      !date.date &&
      ((date.type === 'no-class' && !date.reason) ||
        (date.type === 'follow' && !date.weekday))
    )
  }
  isEmptyMeetingPattern = isEmptyMeetingPattern
}

export default function generator(
  this: AlpineThis<Generator>
): AlpineComponent<Generator> {
  return new Generator(this)
}
/**
 * toIcsDate converts a date to an array in the format [year, month, day] for
 * use with the `ics` library.
 */
export function toIcsDate(d: UTCDate): [number, number, number] {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
}

/**
 * toIcsTime converts a date and time to an array in the format [year, month,
 * day, hour, minute] for use with the `ics` library.
 */
export function toIcsTime(
  d: UTCDate,
  time: string
): [number, number, number, number, number] {
  const [h, m] = time.split(':').map(Number)
  return [d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m]
}

/**
 * encodeCalendar encodes a calendar object into a string via JSON > gzip >
 * base64url encoding.
 */
export async function encodeCalendar(
  calendar: Calendar
): Promise<string | Error> {
  try {
    const x = new Response(
      new TextEncoder().encode(JSON.stringify(calendar))
    ).body!.pipeThrough(new CompressionStream('gzip'))
    return rawBase64URLEncode(await new Response(x).arrayBuffer())
  } catch (e) {
    console.error(e)
    return new Error(String(e))
  }
}

/**
 * decodeCalendar decodes a calendar object from a string via base64url decoding
 * > gunzip > JSON decoding.
 */
export async function decodeConfig(base64: string): Promise<Calendar | Error> {
  try {
    const x = new Response(rawBase64URLDecode(base64)).body!.pipeThrough(
      new DecompressionStream('gzip')
    )
    return await new Response(x).json()
  } catch (e) {
    console.error(e)
    return new Error(String(e))
  }
}

/**
 * rawBase64URLEncode encodes an ArrayBuffer into a base64url string without
 * padding.
 */
function rawBase64URLEncode(arrayBuffer: ArrayBuffer): string {
  return new Uint8Array(arrayBuffer).toBase64({
    alphabet: 'base64url',
    omitPadding: true,
  })
}

/**
 * rawBase64URLDecode decodes a base64url string into an ArrayBuffer without
 * padding.
 */
function rawBase64URLDecode(base64: string): ArrayBuffer {
  return Uint8Array.fromBase64(base64, { alphabet: 'base64url' }).buffer
}
