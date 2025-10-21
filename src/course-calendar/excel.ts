import { UTCDate } from '@date-fns/utc'
import { addDays, isBefore, parse } from 'date-fns'
import type { Sheet } from 'xlsx'
import { academicCalendars, type AcademicCalendar } from './data'
import {
  parseMeetingPattern,
  type CalendarCourse,
  type MeetingPattern,
} from './types'

/**
 * parseExcelCalendar parses an Excel file exported from Workday into a
 * calendar object. It only processes enrolled and completed courses and
 * ignores others. It supports WPI exports only.
 */
export async function parseExcelCalendar(
  xlsxData: any
): Promise<AcademicCalendar | Error> {
  const { read } = await import('xlsx')
  const workbook = read(xlsxData)
  if (workbook.SheetNames.length !== 1) {
    return new Error(
      'Excel file must contain exactly one sheet. Please check that your export is from the correct page.'
    )
  }

  const sheet = await sheetToArray(
    fixSheetRef(workbook.Sheets[workbook.SheetNames[0]])
  )

  // Sanity check: A1 is either "View My Courses" or "My Enrolled Courses"
  // in Workday exports
  if (
    sheet[0][0] !== 'View My Courses' &&
    sheet[0][0] !== 'My Enrolled Courses'
  ) {
    return new Error(
      'Expected first cell to be "View My Courses" or "My Enrolled Courses". Please check that your export is from the correct page.'
    )
  }

  let sectionType = null
  let index = defaultIndices()
  let parseIndices = false
  let calendar: AcademicCalendar | null = null
  for (const [i, row] of sheet.entries()) {
    switch (row[0]) {
      case 'My Enrolled Courses':
        console.debug('Found enrolled courses section at row', i + 1)
        sectionType = 'enrolled'
        index = defaultIndices()
        continue
      case 'My Waitlisted Courses':
        console.debug('Found waitlisted courses section at row', i + 1)
        sectionType = 'waitlisted'
        index = defaultIndices()
        continue
      case 'My Completed Courses':
        console.debug('Found completed courses section at row', i + 1)
        sectionType = 'completed'
        index = defaultIndices()
        continue
      case 'My Dropped/Withdrawn Courses':
        console.debug('Found dropped courses section at row', i + 1)
        sectionType = 'dropped'
        index = defaultIndices()
        continue
      case 'Enrolled Credits':
        console.debug('Found end of semester at row', i + 1)
        sectionType = null
        index = defaultIndices()
        continue
    }
    if (sectionType === 'enrolled' && row[6] === 'Enrolled Sections') {
      parseIndices = true
      continue
    }
    if (sectionType === 'completed' && row[5] === 'Completed Sections') {
      parseIndices = true
      continue
    }
    if (sectionType !== 'enrolled' && sectionType !== 'completed') {
      console.debug('Skipping row', i + 1, `(section type ${sectionType})`)
      continue
    }
    if (parseIndices) {
      index.courseNameNumber = row.indexOf('Course Listing')
      index.registrationStatus = row.indexOf('Registration Status')
      index.courseSection = row.indexOf('Section')
      index.instructionalFormat = row.indexOf('Instructional Format')
      index.meetingPatterns = row.indexOf('Meeting Patterns')
      index.startDate = row.indexOf('Start Date')
      index.endDate = row.indexOf('End Date')

      if (Object.values(index).some((v) => v == null || v == -1)) {
        console.warn(
          `Warning: row ${i + 1}: missing indices for section ${sectionType}`
        )
        console.warn(row)
        console.warn(index)
      }

      parseIndices = false
      continue
    }

    if (
      !sectionType ||
      Object.values(index).some((v) => v == null || v == -1)
    ) {
      console.debug('Skipping row', i + 1)
      continue
    }

    const courseNameNumber = row[index.courseNameNumber]
    const courseSection = row[index.courseSection]
    const registrationStatus = row[index.registrationStatus]
    const instructionalFormat = row[index.instructionalFormat]
    const meetingPatterns =
      row[index.meetingPatterns]
        ?.split('\n')
        .filter(Boolean)
        .map(parseMeetingPattern) ?? []
    const startDate = parse(
      row[index.startDate] ?? '',
      'M/d/yy',
      new UTCDate('2025-01-01 00:00:00')
    )
    const endDate = parse(
      row[index.endDate] ?? '',
      'M/d/yy',
      new UTCDate('2025-01-01 00:00:00')
    )

    if (
      !courseNameNumber ||
      !courseSection ||
      !registrationStatus ||
      !instructionalFormat ||
      !meetingPatterns ||
      !startDate ||
      !endDate
    ) {
      console.warn(
        `Warning: row ${
          i + 1
        }: missing values for section ${sectionType}, skipping`
      )
      console.warn(row)
      console.warn(index)
      continue
    }

    if (!calendar) {
      for (const cal of Object.values(academicCalendars)) {
        if (
          isBefore(cal.range[0], addDays(startDate, 1)) &&
          isBefore(endDate, addDays(cal.range[1], 1))
        ) {
          console.debug(`Matched WPI calendar ${cal.name}`)
          calendar = cal
          break
        }
      }
    }

    if (
      registrationStatus !== 'Registered' &&
      registrationStatus !== 'Completed'
    ) {
      console.debug(
        `Skipping course ${courseNameNumber} in section ${sectionType}: ${registrationStatus}`
      )
    }

    if (!calendar) {
      console.warn(
        `Warning: no matching calendar found, can't process course ${courseSection}`
      )
      continue
    }

    console.debug(`Found course ${courseSection}`)

    let term = null
    for (const t of calendar.terms) {
      if (
        isBefore(new UTCDate(t.start), addDays(startDate, 1)) &&
        isBefore(endDate, addDays(new UTCDate(t.end), 1))
      ) {
        console.debug(`  Matched term ${t.id}`)
        term = t
        break
      }
    }
    if (!term) {
      console.warn(
        `Warning: no matching term found, can't process course ${courseSection}`
      )
      continue
    }

    const [courseNumber, courseName] = courseNameNumber.split(' - ')

    if (meetingPatterns.some(([err]) => err instanceof Error)) {
      console.warn(
        `Warning: failed to parse meeting pattern sfor course ${courseNameNumber}`
      )
      console.warn(meetingPatterns)
      continue
    }

    if (instructionalFormat !== 'Lecture') {
      let course = term.courses.find(
        (c) => c.number === courseNumber && c.name === courseName
      )
      if (!course) {
        console.warn(
          `Warning: course ${courseNameNumber} not found in term ${term.id}`
        )
        continue
      }
      console.debug(`  Matched course ${courseNameNumber}`)

      let name = courseSection.split(' - ')[0].split('-')[1]
      if (
        name[0] === 'A' ||
        name[0] === 'B' ||
        name[0] === 'C' ||
        name[0] === 'D'
      ) {
        name =
          {
            L: 'Lecture',
            D: 'Discussion',
            X: 'Laboratory',
            R: 'Recitation',
          }[name[1]] ?? name
      }

      course.subsections.push({
        name,
        location: meetingPatterns[0][1]!,
        meetingPattern: meetingPatterns[0][0] as MeetingPattern,
        except: [],
      })
      continue
    }

    const course: CalendarCourse = {
      name: courseName,
      number: courseNumber,
      meetingPattern: meetingPatterns[0][0] as MeetingPattern,
      location: meetingPatterns[0][1]!,
      subsections: [],
      except: [],
    }

    // TODO: handle multiple meeting patterns more elegantly
    if (meetingPatterns.length > 1) {
      for (const [mp, location] of meetingPatterns.slice(1)) {
        let name = courseSection.split(' - ')[0].split('-')[1]
        if (
          name[0] === 'A' ||
          name[0] === 'B' ||
          name[0] === 'C' ||
          name[0] === 'D'
        ) {
          name =
            {
              L: 'Lecture',
              D: 'Discussion',
              X: 'Laboratory',
              R: 'Recitation',
              0: 'Lecture',
              1: 'Lecture',
            }[name[1]] ?? name
        }

        course.subsections.push({
          name,
          location: location!,
          meetingPattern: mp as MeetingPattern,
          except: [],
        })
      }
    }
    term.courses.push(course)
  }

  // remove empty terms
  calendar!.terms = calendar!.terms.filter((t) => t.courses.length > 0)

  return calendar ?? new Error('No matching WPI academic calendar found')
}

const cellAddressRegex = /([A-Z]+)([0-9]+)/

/**
 * fixSheetRef fixes the !ref property of a sheet to match the actual sheet
 * range. It mutates the sheet object in-place and returns it.
 */
function fixSheetRef(sheet: Sheet): Sheet {
  let minCol = 'A'
  let minRow = 1
  let maxCol = 'A'
  let maxRow = 1

  for (const cell of Object.keys(sheet)) {
    const match = cellAddressRegex.exec(cell)
    if (!match) continue
    const [, col, row] = match
    if (col < minCol) minCol = col
    if (col > maxCol) maxCol = col
    if (+row < minRow) minRow = +row
    if (+row > maxRow) maxRow = +row
  }

  sheet['!ref'] = `${minCol}${minRow}:${maxCol}${maxRow}`
  return sheet
}

/**
 * sheetHeader returns an array ['0', '1', '2', ...] large enough to address
 * all columns in the sheet.
 */
function sheetHeader(sheet: Sheet): string[] {
  const [minCell, maxCell] = sheet['!ref']!.split(':')
  if (!maxCell) return []

  const minMatch = cellAddressRegex.exec(minCell)
  const maxMatch = cellAddressRegex.exec(maxCell)
  if (!minMatch || !maxMatch) return []

  const minCol = minMatch[1]
  const maxCol = maxMatch[1]

  if (minCol.length === 1 && maxCol.length === 1) {
    const max = maxCol.charCodeAt(0)
    const min = minCol.charCodeAt(0)
    return Array.from({ length: max - min + 1 }, (_, i) => i.toString())
  }

  throw new Error('>26col header not implemented')
}

/**
 * sheetToArray converts a sheet to a 2D array of strings. Numbers and dates
 * are represented as strings, with dates formatted as MM/DD/YY.
 */
async function sheetToArray(sheet: Sheet): Promise<(string | null)[][]> {
  const { utils } = await import('xlsx')

  const header = sheetHeader(sheet)
  const json = utils.sheet_to_json<Record<string, any>>(sheet, {
    header,
    raw: false,
  })

  const rows = json
    .map((row) => {
      row.length = header.length
      return row
    })
    .map((row) => Array.from(row as any))

  return rows as any
}

/**
 * defaultIndices returns the default indices for the indices object.
 */
function defaultIndices() {
  return {
    courseNameNumber: -1,
    registrationStatus: -1,
    courseSection: -1,
    instructionalFormat: -1,
    meetingPatterns: -1,
    startDate: -1,
    endDate: -1,
  }
}
