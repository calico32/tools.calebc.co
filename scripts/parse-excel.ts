import * as fs from 'node:fs/promises'
import { parseExcelCalendar } from '../src/course-calendar/excel'
const file = process.argv[2]
if (!file) {
  console.error(`Usage: ${process.argv0} parse-excel.ts <file>`)
  process.exit(1)
}

const calendar = parseExcelCalendar(await fs.readFile(file))
console.log(calendar)
