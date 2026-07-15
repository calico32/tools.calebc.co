import { parse } from "@bgotink/kdl"
import { expect, test } from "vitest"

import { calendarToKdl } from "./kdl.ts"
import { type Calendar, Weekday } from "./types.ts"

const calendar: Calendar = {
	name: "WPI",
	terms: [
		{
			id: "A26",
			start: "2026-08-20",
			end: "2026-10-09",
			dates: [
				{ date: "2026-09-07", type: "no-class", reason: "Labor Day" },
				{ date: "2026-09-10", type: "follow", weekday: Weekday.Monday },
				{ date: "2026-09-25", type: "no-class", reason: "Wellness Day", hidden: true },
				{ date: "2026-10-01", type: "no-class" },
			],
			courses: [
				{
					number: "CH 1234",
					name: "Chemistry",
					section: "AL01",
					instructor: "John Doe",
					except: ["2026-09-03"],
					meetingPatterns: [
						{
							startTime: "10:00",
							endTime: "10:50",
							weekdays: [
								Weekday.Monday,
								Weekday.Tuesday,
								Weekday.Thursday,
								Weekday.Friday,
							],
							location: "ABC 123",
						},
					],
					subsections: [
						{
							name: "Lab",
							section: "AX01",
							except: [],
							meetingPatterns: [
								{
									startTime: "12:00",
									endTime: "13:50",
									weekdays: [Weekday.Monday, Weekday.Thursday],
									location: "DEF 456",
								},
							],
						},
					],
				},
				{
					number: "CS 1234",
					name: "Algorithms",
					except: [],
					meetingPatterns: [
						{
							startTime: "14:00",
							endTime: "14:50",
							weekdays: [Weekday.Monday, Weekday.Wednesday, Weekday.Friday],
							location: null,
						},
					],
					subsections: [],
				},
			],
		},
	],
}

test("serializes a full calendar", () => {
	expect(calendarToKdl(calendar)).toBe(`name WPI
term A26 {
	start "8/20/2026"
	date "9/7/2026" { no-class "Labor Day" }
	date "9/10/2026" { follow monday }
	date "9/25/2026" { no-class "Wellness Day"; hidden }
	date "10/1/2026" { no-class "No classes" }
	end "10/9/2026"
	class "CH 1234" Chemistry {
		section AL01
		date "9/3/2026" { no-class }
		meeting-pattern "M-T-R-F | 10:00 AM - 10:50 AM | ABC 123"
		instructor "John Doe"
		component Lab {
			section AX01
			meeting-pattern "M-R | 12:00 PM - 1:50 PM | DEF 456"
		}
	}
	class "CS 1234" Algorithms {
		meeting-pattern "M-W-F | 2:00 PM - 2:50 PM"
	}
}
`)
})

test("output is valid KDL", () => {
	expect(() => parse(calendarToKdl(calendar))).not.toThrow()
})

test("time edge cases", () => {
	const cal: Calendar = {
		name: "X",
		terms: [
			{
				id: "T",
				start: "2026-01-05",
				end: "2026-01-09",
				dates: [],
				courses: [
					{
						number: "N 1",
						name: "Midnight",
						except: [],
						subsections: [],
						meetingPatterns: [
							{
								startTime: "00:30",
								endTime: "12:00",
								weekdays: [Weekday.Friday],
								location: null,
							},
						],
					},
				],
			},
		],
	}
	expect(calendarToKdl(cal)).toContain('meeting-pattern "F | 12:30 AM - 12:00 PM"')
})
