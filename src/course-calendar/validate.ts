import { UTCDate } from '@date-fns/utc'
import { weekdayToString, type Calendar } from './types'

export function validate(calendar: Calendar): {
  errors: string[]
  warnings: { title: string; message: string }[]
} {
  const errors: string[] = []
  const warnings: { title: string; message: string }[] = []

  if (!calendar.terms.length) {
    errors.push(`No terms defined.`)
  }

  if (!calendar.terms.flatMap((term) => term.courses).length) {
    errors.push(`No courses defined.`)
  }

  const termNames = new Set<string>()
  for (const [index, term] of calendar.terms.entries()) {
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
      if (!course.meetingPatterns.length) {
        warnings.push({
          title: `No meeting patterns for course ${courseName} in term ${termName}`,
          message: `Add a meeting pattern for this course, if applicable. It will be ignored otherwise.`,
        })
      }
      for (const mp of course.meetingPatterns) {
        if (!mp.startTime) {
          errors.push(
            `Term ${termName}, course ${courseName}: missing/invalid start time`
          )
        }
        if (!mp.endTime) {
          errors.push(
            `Term ${termName}, course ${courseName}: missing/invalid end time`
          )
        }
        if (mp.startTime && mp.endTime && mp.startTime > mp.endTime) {
          errors.push(`Term ${termName}, course ${courseName}: start > end`)
        }
        if (mp.weekdays.length === 0) {
          errors.push(
            `Term ${termName}, course ${courseName}: no weekdays selected`
          )
        }
        if (!mp.location) {
          warnings.push({
            title: `Missing location for course ${courseName} in term ${termName}`,
            message: `Add a location for this course, if applicable.`,
          })
        }
      }

      for (const [index, subsection] of course.subsections.entries()) {
        const subsectionName = subsection.name || '#' + (index + 1)
        if (!subsection.name) {
          errors.push(
            `Term ${termName}, course ${courseName}, component ${subsectionName}: missing/invalid name`
          )
        }
        if (!subsection.meetingPatterns.length) {
          warnings.push({
            title: `No meeting patterns for component ${subsection} of course ${courseName} in term ${termName}`,
            message: `Add a meeting pattern for this component, if applicable. It will be ignored otherwise.`,
          })
        }
        for (const mp of subsection.meetingPatterns) {
          if (!mp.startTime) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: missing/invalid start time`
            )
          }
          if (!mp.endTime) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: missing/invalid end time`
            )
          }
          if (mp.startTime && mp.endTime && mp.startTime > mp.endTime) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: start > end`
            )
          }
          if (mp.weekdays.length === 0) {
            errors.push(
              `Term ${termName}, course ${courseName}, component ${subsectionName}: no weekdays selected`
            )
          }
          if (!mp.location) {
            warnings.push({
              title: `Missing location for component ${subsection} of course ${courseName} in term ${termName}`,
              message: `Add a location for this component, if applicable.`,
            })
          }
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

  return { errors, warnings }
}
