import { UTCDate } from '@date-fns/utc'
import { Weekday, type CalendarTerm } from './types'

export interface AcademicCalendar {
  name: string
  year: [number, number]
  range: [UTCDate, UTCDate]
  terms: CalendarTerm[]
}

const ay_2025_2026: AcademicCalendar = {
  name: 'WPI AY 2025-2026',
  year: [2025, 2026],
  range: [new UTCDate('2025-08-21'), new UTCDate('2026-05-06')],
  terms: [
    {
      id: 'A25',
      start: '2025-08-21',
      dates: [
        { date: '2025-09-01', type: 'no-class', reason: 'Labor Day' },
        { date: '2025-09-04', type: 'follow', weekday: Weekday.Monday },
        { date: '2025-09-19', type: 'no-class', reason: 'Wellness Day' },
      ],
      end: '2025-10-10',
      courses: [],
    },
    {
      id: 'B25',
      start: '2025-10-20',
      dates: [
        { date: '2025-11-04', type: 'no-class', reason: 'Wellness Day' },
        { date: '2025-11-26', type: 'no-class', reason: 'Thanksgiving' },
        { date: '2025-11-27', type: 'no-class', reason: 'Thanksgiving' },
        { date: '2025-11-28', type: 'no-class', reason: 'Thanksgiving' },
        { date: '2025-12-08', type: 'no-class', reason: 'Reading Day' },
      ],
      end: '2025-12-12',
      courses: [],
    },
    {
      id: 'F25',
      start: '2025-08-21',
      dates: [
        { date: '2025-09-01', type: 'no-class', reason: 'Labor Day' },
        { date: '2025-09-04', type: 'follow', weekday: Weekday.Monday },
        { date: '2025-09-19', type: 'no-class', reason: 'Wellness Day' },
        // A term ends 10/10
        { date: '2025-10-11', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2025-10-12', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2025-10-13', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2025-10-14', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2025-10-15', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2025-10-16', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2025-10-17', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2025-10-18', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2025-10-19', type: 'no-class', reason: 'Break', hidden: true },
        // B term begins 10/20
        { date: '2025-11-04', type: 'no-class', reason: 'Wellness Day' },
        { date: '2025-11-26', type: 'no-class', reason: 'Thanksgiving' },
        { date: '2025-11-27', type: 'no-class', reason: 'Thanksgiving' },
        { date: '2025-11-28', type: 'no-class', reason: 'Thanksgiving' },
        { date: '2025-12-08', type: 'no-class', reason: 'Reading Day' },
      ],
      end: '2025-12-12',
      courses: [],
    },
    {
      id: 'C26',
      start: '2026-01-14',
      dates: [
        { date: '2026-01-14', type: 'follow', weekday: Weekday.Monday },
        { date: '2026-01-19', type: 'no-class', reason: 'MLK Jr. Day' },
        { date: '2026-02-13', type: 'no-class', reason: 'Wellness Day' },
        {
          date: '2026-02-26',
          type: 'no-class',
          reason: 'Academic Advising Day',
        },
      ],
      end: '2026-03-06',
      courses: [],
    },
    {
      id: 'D26',
      start: '2026-03-16',
      dates: [
        { date: '2026-03-30', type: 'no-class', reason: 'Wellness Day' },
        { date: '2026-04-01', type: 'follow', weekday: Weekday.Monday },
        { date: '2026-04-20', type: 'no-class', reason: "Patriot's Day" },
        { date: '2026-04-24', type: 'no-class', reason: 'URP Showcase' },
        { date: '2026-05-06', type: 'follow', weekday: Weekday.Friday },
      ],
      end: '2026-05-06',
      courses: [],
    },
    {
      id: 'S26',
      start: '2026-01-14',
      dates: [
        { date: '2026-01-14', type: 'follow', weekday: Weekday.Monday },
        { date: '2026-01-19', type: 'no-class', reason: 'MLK Jr. Day' },
        { date: '2026-02-13', type: 'no-class', reason: 'Wellness Day' },
        {
          date: '2026-02-26',
          type: 'no-class',
          reason: 'Academic Advising Day',
        },
        // C term ends 3/6
        { date: '2026-03-07', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2026-03-08', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2026-03-09', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2026-03-10', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2026-03-11', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2026-03-12', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2026-03-13', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2026-03-14', type: 'no-class', reason: 'Break', hidden: true },
        { date: '2026-03-15', type: 'no-class', reason: 'Break', hidden: true },
        // D term begins 3/16
        { date: '2026-03-30', type: 'no-class', reason: 'Wellness Day' },
        { date: '2026-04-01', type: 'follow', weekday: Weekday.Monday },
        { date: '2026-04-20', type: 'no-class', reason: "Patriot's Day" },
        { date: '2026-04-24', type: 'no-class', reason: 'URP Showcase' },
        { date: '2026-05-06', type: 'follow', weekday: Weekday.Friday },
      ],
      end: '2026-05-06',
      courses: [],
    },
  ],
}

const ay_e2026: AcademicCalendar = {
  name: 'WPI E-Term 2026',
  year: [2026, 2026],
  range: [new UTCDate('2026-05-21'), new UTCDate('2026-08-07')],
  terms: [
    {
      id: 'E1',
      start: '2026-05-21',
      dates: [
        { date: '2026-05-25', type: 'no-class', reason: 'Memorial Day' },
        { date: '2026-05-28', type: 'follow', weekday: Weekday.Monday },
        { date: '2026-06-19', type: 'no-class', reason: 'Juneteenth' },
      ],
      end: '2026-06-26',
      courses: [],
    },
    {
      id: 'E2',
      start: '2026-07-06',
      dates: [],
      end: '2026-08-07',
      courses: [],
    },
  ],
}

export const academicCalendars = {
  '2025-2026': ay_2025_2026,
  '2026-E': ay_e2026,
}
