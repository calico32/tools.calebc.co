import { Document, format, type Node } from "@bgotink/kdl"
import { type SerializationContext, serialize } from "@bgotink/kdl/dessert"
import { formatDate, parse } from "date-fns"

import {
	type Calendar,
	type CalendarCourse,
	type CalendarDate,
	type CalendarSection,
	type CalendarTerm,
	type MeetingPattern,
	weekdayToString,
} from "./types.ts"

/** toKdlDate converts a "yyyy-MM-dd" date to "M/D/YYYY" without leading zeros. */
function toKdlDate(date: string): string {
	const [y, m, d] = date.split("-")
	return `${+m}/${+d}/${y}`
}

/** toKdlTime converts a 24-hour "HH:mm" time to "h:mm AM/PM". */
function toKdlTime(time: string): string {
	return formatDate(parse(time, "HH:mm", new Date(0)), "h:mm a")
}

function meetingPatternToString(mp: MeetingPattern): string {
	const days = mp.weekdays.map((w) => weekdayToString(w, true)).join("-")
	const times = `${toKdlTime(mp.startTime)} - ${toKdlTime(mp.endTime)}`
	return mp.location ? `${days} | ${times} | ${mp.location}` : `${days} | ${times}`
}

function serializeDate(ctx: SerializationContext, date: CalendarDate) {
	ctx.argument(toKdlDate(date.date))
	if (date.type === "no-class") {
		ctx.child("no-class", (c) => c.argument(date.reason ?? "No classes"))
		if (date.hidden) ctx.child("hidden", () => {})
	} else {
		ctx.child("follow", (c) => c.argument(weekdayToString(date.weekday).toLowerCase()))
	}
}

function serializeSection(ctx: SerializationContext, section: CalendarSection) {
	ctx.argument(section.name)
	if (section.section) ctx.child("section", (c) => c.argument(section.section!))
	for (const mp of section.meetingPatterns) {
		ctx.child("meeting-pattern", (c) => c.argument(meetingPatternToString(mp)))
	}
	if (section.instructor) ctx.child("instructor", (c) => c.argument(section.instructor!))
}

function serializeCourse(ctx: SerializationContext, course: CalendarCourse) {
	ctx.argument(course.number)
	ctx.argument(course.name)
	if (course.section) ctx.child("section", (c) => c.argument(course.section!))
	for (const date of course.except) {
		ctx.child("date", (c) => {
			c.argument(toKdlDate(date))
			c.child("no-class", () => {})
		})
	}
	for (const mp of course.meetingPatterns) {
		ctx.child("meeting-pattern", (c) => c.argument(meetingPatternToString(mp)))
	}
	if (course.instructor) ctx.child("instructor", (c) => c.argument(course.instructor!))
	for (const section of course.subsections) {
		ctx.child("component", serializeSection, section)
	}
}

function serializeTerm(ctx: SerializationContext, term: CalendarTerm) {
	ctx.argument(term.id)
	ctx.child("start", (c) => c.argument(toKdlDate(term.start)))
	for (const date of term.dates) {
		ctx.child("date", serializeDate, date)
	}
	ctx.child("end", (c) => c.argument(toKdlDate(term.end)))
	for (const course of term.courses) {
		ctx.child("class", serializeCourse, course)
	}
}

/**
 * singleLineDates rewrites the whitespace of every `date` node in the tree so its children render
 * on one line, e.g. `date "9/7/2026" { no-class "Labor Day"; hidden }`.
 */
function singleLineDates(node: Node) {
	for (const child of node.children?.nodes ?? []) {
		if (child.getName() === "date" && child.children) {
			const kids = child.children.nodes
			for (let i = 0; i < kids.length; i++) {
				kids[i].leading = " "
				kids[i].trailing = i < kids.length - 1 ? ";" : " "
			}
			child.children.trailing = ""
		} else {
			singleLineDates(child)
		}
	}
}

/** calendarToKdl serializes a Calendar to a KDL document string. */
export function calendarToKdl(calendar: Calendar): string {
	const doc = new Document()
	doc.appendNode(serialize("name", (ctx) => ctx.argument(calendar.name)))
	for (const term of calendar.terms) {
		const node = serialize("term", serializeTerm, term)
		singleLineDates(node)
		doc.appendNode(node)
	}
	return format(doc)
}
