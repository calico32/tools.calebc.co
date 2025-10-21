import { UTCDate } from '@date-fns/utc'
import type { AlpineComponent } from 'alpinejs'
import { addDays, addMinutes, formatDate, isBefore } from 'date-fns'
import * as ics from 'ics'
import * as toaster from 'x-toaster'
import type { AlpineThis, Persist } from '../types'
import { academicCalendars } from './data'
import { parseExcelCalendar } from './excel'
import {
  weekdayToString,
  type Calendar,
  type CalendarCourse,
  type CalendarTerm,
  type MeetingPattern,
  type Weekday,
} from './types'

class Generator implements AlpineComponent<Generator> {
  // calendar will be created by the Alpine factory using $persist so we don't
  // initialize it in the constructor here.
  calendar!: Persist<Calendar>
  errors: string[]
  ical: string | null
  constructor(alpine: AlpineThis<Generator>) {
    this.calendar = alpine.$persist({
      name: '',
      terms: [],
    })
    this.errors = []
    this.ical = null
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
      location: '',
      meetingPattern: { startTime: '', endTime: '', weekdays: [] },
      except: [],
      subsections: [],
    })
  }

  /** addSpecialDate adds a special date to the given term. */
  addSpecialDate(this: AlpineThis<Generator>, term: CalendarTerm): void {
    term.dates.push({ date: '', type: 'no-class', reason: '' })
  }

  /** addSubsection adds an empty subsection to the given course. */
  addSubsection(this: AlpineThis<Generator>, course: CalendarCourse): void {
    course.subsections.push({
      name: '',
      location: '',
      meetingPattern: { startTime: '', endTime: '', weekdays: [] },
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

  /** validate returns a list of errors in the calendar. */
  validate(this: AlpineThis<Generator>): string[] {
    const errors: string[] = []

    if (!this.calendar.terms.length) {
      errors.push(`No terms defined.`)
    }

    if (!this.calendar.terms.flatMap((term) => term.courses).length) {
      errors.push(`No courses defined.`)
    }

    const termNames = new Set<string>()
    for (const [index, term] of this.calendar.terms.entries()) {
      const termName = term.id || '#' + (index + 1)
      if (!term.id) {
        errors.push(`Term ${termName}: missing/invalid name`)
      }
      if (termNames.has(term.id)) {
        errors.push(`Term ${termName}: duplicate name`)
      }
      termNames.add(term.id)
      if (!term.start) {
        errors.push(`Term ${termName}: missing/invalid start date`)
      }
      if (!term.end) {
        errors.push(`Term ${termName}: missing/invalid end date`)
      }
      if (term.start && term.end && term.start > term.end) {
        errors.push(`Term ${termName}: start > end`)
      }
      for (const special of term.dates) {
        if (!special.date) {
          errors.push(`Term ${termName}: missing/invalid date`)
        } else {
          if (special.date < term.start) {
            errors.push(
              `Term ${termName}: special date ${special.date} before term start`
            )
          } else if (special.date > term.end) {
            errors.push(
              `Term ${termName}: special date ${special.date} after term end`
            )
          }
          if (
            special.type === 'follow' &&
            new UTCDate(special.date).getDay() == special.weekday
          ) {
            errors.push(
              `Term ${termName}: special date ${
                special.date
              } does nothing (already a ${weekdayToString(special.weekday)})`
            )
          }
        }
      }
      for (const course of term.courses) {
        const courseName = course.number || '#' + (index + 1)
        if (!course.number) {
          errors.push(
            `Term ${termName}, course ${courseName}: missing/invalid number`
          )
        }
        if (!course.name) {
          errors.push(
            `Term ${termName}, course ${courseName}: missing/invalid name`
          )
        }
        if (!course.location) {
          errors.push(
            `Term ${termName}, course ${courseName}: missing/invalid location`
          )
        }
        if (!course.meetingPattern.startTime) {
          errors.push(
            `Term ${termName}, course ${courseName}: missing/invalid start time`
          )
        }
        if (!course.meetingPattern.endTime) {
          errors.push(
            `Term ${termName}, course ${courseName}: missing/invalid end time`
          )
        }
        if (
          course.meetingPattern.startTime &&
          course.meetingPattern.endTime &&
          course.meetingPattern.startTime > course.meetingPattern.endTime
        ) {
          errors.push(`Term ${termName}, course ${courseName}: start > end`)
        }
        if (course.meetingPattern.weekdays.length === 0) {
          errors.push(
            `Term ${termName}, course ${courseName}: no weekdays selected`
          )
        }
        for (const subsection of course.subsections) {
          const subsectionName = subsection.name || '#'
          if (!subsection.name) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: missing/invalid name`
            )
          }
          if (!subsection.location) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: missing/invalid location`
            )
          }
          if (!subsection.meetingPattern.startTime) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: missing/invalid start time`
            )
          }
          if (!subsection.meetingPattern.endTime) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: missing/invalid end time`
            )
          }
          if (
            subsection.meetingPattern.startTime &&
            subsection.meetingPattern.endTime &&
            subsection.meetingPattern.startTime >
              subsection.meetingPattern.endTime
          ) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: start > end`
            )
          }
          if (subsection.meetingPattern.weekdays.length === 0) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: no weekdays selected`
            )
          }
        }
        for (const special of course.except) {
          if (!special) {
            errors.push(
              `Term ${termName}, course ${courseName}: missing/invalid special date`
            )
          } else if (special < term.start) {
            errors.push(
              `Term ${termName}, course ${courseName}: special date ${special} before term start`
            )
          } else if (special > term.end) {
            errors.push(
              `Term ${termName}, course ${courseName}: special date ${special} after term end`
            )
          }
        }
      }
    }

    return errors
  }

  /** generateICal generates an .ics file from the calendar and stores it. */
  async generateICal(this: AlpineThis<Generator>): Promise<void> {
    const errors = this.validate()
    if (errors.length) {
      this.errors = errors
      this.ical = null
      return
    }

    const events: ics.EventAttributes[] = []
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
        let weekday = new UTCDate(d).getDay() as Weekday
        for (const special of term.dates) {
          if (special.date === formatDate(d, 'yyyy-MM-dd')) {
            if (special.type === 'no-class') {
              events.push({
                uid: `course-calendar-${special.date}-no-class@tools.calebc.co`,
                start: toIcsDate(d),
                end: toIcsDate(addDays(d, 1)),
                title: special.reason
                  ? `No Classes (${special.reason})`
                  : 'No Classes',
              })
              continue outer
            } else if (special.type === 'follow') {
              weekday = special.weekday
              events.push({
                uid: `course-calendar-${special.date}-follow@tools.calebc.co`,
                start: toIcsDate(d),
                end: toIcsDate(addDays(d, 1)),
                title: `Follow ${weekdayToString(weekday)} Schedule`,
              })
              break
            }
          }
        }
        for (const course of term.courses) {
          if (course.meetingPattern.weekdays.includes(weekday)) {
            events.push({
              uid: `course-calendar-${course.number.replaceAll(
                ' ',
                ''
              )}-${formatDate(d, 'yyyy-MM-dd')}@tools.calebc.co`,
              start: toIcsTime(d, course.meetingPattern.startTime),
              end: toIcsTime(d, course.meetingPattern.endTime),
              title: `${course.number} - ${course.name}`,
              location: course.location,
            })
          }
          for (const subsection of course.subsections) {
            if (subsection.meetingPattern.weekdays.includes(weekday)) {
              events.push({
                uid: `course-calendar-${course.number.replaceAll(
                  ' ',
                  ''
                )}-${subsection.name.replaceAll(' ', '')}-${formatDate(
                  d,
                  'yyyy-MM-dd'
                )}@tools.calebc.co`,
                start: toIcsTime(d, subsection.meetingPattern.startTime),
                end: toIcsTime(d, subsection.meetingPattern.endTime),
                title: `${course.number} - ${course.name} (${subsection.name})`,
                location: subsection.location,
              })
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

    const { error, value } = ics.createEvents(events, {
      calName: this.calendar.name.trim() || 'Course Calendar',
      productId: '-//tools.calebc.co//' + calendarData + '//EN',
    })
    if (error) {
      this.errors = [...this.errors, error.message]
      this.ical = null
    } else {
      this.errors = []
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
    const cal = await parseExcelCalendar(await file.arrayBuffer())
    loading.hide()
    if (cal instanceof Error) {
      toaster.show({
        message: cal.message,
        class: 'error',
      })
      return
    }
    this.calendar.terms.splice(0, this.calendar.terms.length)
    this.calendar.name = cal.name
    this.calendar.terms.push(...cal.terms)
    ;(this.$refs.excelInput as HTMLInputElement).value = ''
    toaster.show({
      message: 'Import succeeded. Review and make any necessary changes below.',
      class: 'success',
    })
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
function toIcsDate(d: UTCDate): [number, number, number] {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
}

/**
 * toIcsTime converts a date and time to an array in the format [year, month,
 * day, hour, minute] for use with the `ics` library.
 */
function toIcsTime(
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
async function encodeCalendar(calendar: Calendar): Promise<string | Error> {
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
async function decodeConfig(base64: string): Promise<Calendar | Error> {
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
