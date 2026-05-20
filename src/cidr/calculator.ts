import type { AlpineComponent } from "alpinejs"
import * as toaster from "x-toaster"

import type { AlpineThis, Persist } from "../types"
import { colorFor } from "./color"
import type { HilbertSegment, HilbertView } from "./hilbert"

/** A normalized CIDR network. `addr` is always the network address. */
export interface Net {
	version: 4 | 6
	bits: 32 | 128
	prefix: number
	addr: bigint
}

const V4_BITS = 32
const V6_BITS = 128

function fullMask(bits: number): bigint {
	return (1n << BigInt(bits)) - 1n
}

/** NetMask returns the bigint mask for the given prefix length. */
function netMask(prefix: number, bits: number): bigint {
	if (prefix <= 0) return 0n
	if (prefix >= bits) return fullMask(bits)
	const hostBits = BigInt(bits - prefix)
	return fullMask(bits) ^ ((1n << hostBits) - 1n)
}

/** ParseIPv4 parses dotted-quad notation into a 32-bit value. */
function parseIPv4(input: string): bigint | null {
	const parts = input.split(".")
	if (parts.length !== 4) return null
	let addr = 0n
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null
		const n = Number(part)
		if (n > 255) return null
		addr = (addr << 8n) | BigInt(n)
	}
	return addr
}

/** ParseIPv6 parses an IPv6 address (incl. `::` compression and embedded IPv4) into a 128-bit value. */
function parseIPv6(input: string): bigint | null {
	if (input === "" || input.includes("%")) return null
	const doubleColons = input.match(/::/g)?.length ?? 0
	if (doubleColons > 1) return null

	let headStr: string
	let tailStr: string
	if (doubleColons === 1) {
		const idx = input.indexOf("::")
		headStr = input.slice(0, idx)
		tailStr = input.slice(idx + 2)
	} else {
		headStr = input
		tailStr = ""
	}

	const toGroups = (str: string): number[] | null => {
		if (str === "") return []
		const parts = str.split(":")
		const groups: number[] = []
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]
			if (part.includes(".")) {
				// embedded IPv4 is only valid as the final element
				if (i !== parts.length - 1) return null
				const v4 = parseIPv4(part)
				if (v4 === null) return null
				groups.push(Number((v4 >> 16n) & 0xffffn))
				groups.push(Number(v4 & 0xffffn))
				continue
			}
			if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null
			groups.push(parseInt(part, 16))
		}
		return groups
	}

	const head = toGroups(headStr)
	const tail = toGroups(tailStr)
	if (head === null || tail === null) return null

	let groups: number[]
	if (doubleColons === 1) {
		const total = head.length + tail.length
		if (total > 7) return null // :: must cover >= 1 zero group
		groups = [...head, ...Array(8 - total).fill(0), ...tail]
	} else {
		if (head.length !== 8) return null
		groups = head
	}

	let addr = 0n
	for (const g of groups) addr = (addr << 16n) | BigInt(g)
	return addr
}

/**
 * ParseCidr parses `ip` or `ip/prefix` into a normalized {@link Net}. A bare address becomes a host
 * route (/32 or /128).
 */
function parseCidr(input: string): Net | { error: string } {
	const token = input.trim()
	if (token === "") return { error: "empty" }
	const slash = token.indexOf("/")
	const ipPart = slash === -1 ? token : token.slice(0, slash)
	const prefixPart = slash === -1 ? null : token.slice(slash + 1)

	let version: 4 | 6
	let bits: 32 | 128
	let raw: bigint | null
	if (ipPart.includes(":")) {
		version = 6
		bits = V6_BITS
		raw = parseIPv6(ipPart)
	} else {
		version = 4
		bits = V4_BITS
		raw = parseIPv4(ipPart)
	}
	if (raw === null)
		return { error: `invalid ${version === 4 ? "IPv4" : "IPv6"} address "${ipPart}"` }

	let prefix: number
	if (prefixPart === null) {
		prefix = bits
	} else {
		if (!/^\d{1,3}$/.test(prefixPart)) return { error: `invalid prefix "/${prefixPart}"` }
		prefix = Number(prefixPart)
		if (prefix > bits) return { error: `prefix /${prefix} out of range (max /${bits})` }
	}

	return { version, bits, prefix, addr: raw & netMask(prefix, bits) }
}

/** Contains reports whether `a` fully contains `b`. */
function contains(a: Net, b: Net): boolean {
	if (a.version !== b.version) return false
	if (a.prefix > b.prefix) return false
	return (b.addr & netMask(a.prefix, a.bits)) === a.addr
}

/**
 * Subtract removes every network in `removals` from `base`, returning the minimal set of CIDR
 * blocks that cover the remainder.
 */
function subtract(base: Net, removals: Net[]): Net[] {
	const relevant = removals.filter((r) => contains(base, r) || contains(r, base))
	if (relevant.length === 0) return [base]
	if (relevant.some((r) => contains(r, base))) return []

	const childPrefix = base.prefix + 1
	const half = 1n << BigInt(base.bits - childPrefix)
	const left: Net = { ...base, prefix: childPrefix }
	const right: Net = { ...base, prefix: childPrefix, addr: base.addr | half }
	const l = subtract(left, relevant)
	const r = subtract(right, relevant)

	// both halves untouched -> collapse back into the parent
	if (
		l.length === 1 &&
		r.length === 1 &&
		l[0].prefix === childPrefix &&
		l[0].addr === left.addr &&
		r[0].prefix === childPrefix &&
		r[0].addr === right.addr
	) {
		return [base]
	}
	return [...l, ...r]
}

export function formatAddr(addr: bigint, version: 4 | 6): string {
	return version === 4 ? formatIPv4(addr) : formatIPv6(addr)
}

function formatIPv4(addr: bigint): string {
	return [(addr >> 24n) & 0xffn, (addr >> 16n) & 0xffn, (addr >> 8n) & 0xffn, addr & 0xffn].join(
		".",
	)
}

/** FormatIPv6 renders the canonical RFC 5952 form (lowercase, longest zero-run compressed to `::`). */
function formatIPv6(addr: bigint): string {
	const groups: number[] = []
	for (let i = 7; i >= 0; i--) groups.push(Number((addr >> BigInt(i * 16)) & 0xffffn))

	let bestStart = -1
	let bestLen = 0
	let curStart = -1
	let curLen = 0
	for (let i = 0; i < 8; i++) {
		if (groups[i] === 0) {
			if (curStart === -1) curStart = i
			curLen++
			if (curLen > bestLen) {
				bestLen = curLen
				bestStart = curStart
			}
		} else {
			curStart = -1
			curLen = 0
		}
	}

	const hex = groups.map((g) => g.toString(16))
	if (bestLen < 2) return hex.join(":")
	const head = hex.slice(0, bestStart).join(":")
	const tail = hex.slice(bestStart + bestLen).join(":")
	return `${head}::${tail}`
}

export function formatNet(net: Net): string {
	const ip = net.version === 4 ? formatIPv4(net.addr) : formatIPv6(net.addr)
	return `${ip}/${net.prefix}`
}

function netSize(net: Net): bigint {
	return 1n << BigInt(net.bits - net.prefix)
}

interface ComputeResult {
	error: string | null
	base: Net | null
	remainder: Net[]
	removals: Net[]
	cidrs: string[]
	ignored: string[]
	notes: string[]
	count: number
	total: bigint
}

/** Compute parses the inputs and runs the subtraction, returning everything the view needs. */
function compute(baseInput: string, excludeInput: string): ComputeResult {
	const result: ComputeResult = {
		error: null,
		base: null,
		remainder: [],
		removals: [],
		cidrs: [],
		ignored: [],
		notes: [],
		count: 0,
		total: 0n,
	}

	if (baseInput.trim() === "") {
		result.error = "Enter a base network."
		return result
	}

	const base = parseCidr(baseInput)
	if ("error" in base) {
		result.error = `Base network: ${base.error}.`
		return result
	}
	if (formatNet(base) !== baseInput.trim()) {
		result.notes.push(`Base normalized to ${formatNet(base)}.`)
	}
	result.base = base

	const removals: Net[] = []
	for (const token of excludeInput.split(/[\s,]+/).filter(Boolean)) {
		const net = parseCidr(token)
		if ("error" in net) {
			result.ignored.push(`${token} — ${net.error}`)
			continue
		}
		if (net.version !== base.version) {
			result.ignored.push(`${formatNet(net)} — IPv${net.version}, base is IPv${base.version}`)
			continue
		}
		if (!contains(base, net) && !contains(net, base)) {
			result.ignored.push(`${formatNet(net)} — outside ${formatNet(base)}`)
			continue
		}
		removals.push(net)
	}

	const remainder = subtract(base, removals)
	result.remainder = remainder
	result.removals = removals
	result.cidrs = remainder.map(formatNet)
	result.count = remainder.length
	result.total = remainder.reduce((sum, n) => sum + netSize(n), 0n)
	return result
}

interface HoverInfo {
	kind: "remainder" | "excluded"
	cidr: string
	count: string
	first: string
	last: string
	x: number
	y: number
}

export class Calculator implements AlpineComponent<Calculator> {
	input: Persist<{ base: string; excludes: string }>
	error: string | null = null
	base: Net | null = null
	remainder: Net[] = []
	removals: Net[] = []
	cidrs: string[] = []
	ignored: string[] = []
	notes: string[] = []
	count = 0
	total = "0"
	hover: HoverInfo | null = null

	view: HilbertView | null = null
	currentCanvas: HTMLCanvasElement | null = null
	currentSeg: HilbertSegment | null = null

	constructor(alpine: AlpineThis<Calculator>) {
		this.input = alpine.$persist({ base: "", excludes: "" })
	}

	init(this: AlpineThis<Calculator>): void {
		this.recompute()
		this.$watch("input", () => this.recompute())
	}

	recompute(this: AlpineThis<Calculator>): void {
		const r = compute(this.input.base, this.input.excludes)
		this.error = r.error
		this.base = r.base
		this.remainder = r.remainder
		this.removals = r.removals
		this.cidrs = r.cidrs
		this.ignored = r.ignored
		this.notes = r.notes
		this.count = r.count
		this.total = r.total.toLocaleString("en-US")
	}

	async redraw(this: AlpineThis<Calculator>, canvas: HTMLCanvasElement): Promise<void> {
		if (!this.base) return
		const { renderHilbert } = await import("./hilbert")
		const view = renderHilbert(canvas, this.base, this.remainder, this.removals)
		this.view = view
		this.currentSeg = null
		this.hover = null
		if (this.currentCanvas !== canvas) {
			this.currentCanvas = canvas
			canvas.addEventListener("mousemove", (e) => this.onHilbertMove(e))
			canvas.addEventListener("mouseleave", () => this.onHilbertLeave())
		}
	}

	onHilbertMove(this: AlpineThis<Calculator>, e: MouseEvent): void {
		if (!this.view || !this.base) return
		const canvas = e.currentTarget as HTMLCanvasElement
		const rect = canvas.getBoundingClientRect()
		const offsetX = e.clientX - rect.left
		const offsetY = e.clientY - rect.top
		const seg = this.view.segmentAt(offsetX, offsetY)
		if (seg !== this.currentSeg) {
			this.currentSeg = seg
			this.view.setHighlight(seg)
		}
		if (!seg) {
			this.hover = null
			return
		}
		const size = seg.end - seg.start
		this.hover = {
			kind: seg.kind,
			cidr: formatNet(seg.net),
			count: size.toLocaleString("en-US"),
			first: formatAddr(seg.start, this.base.version),
			last: formatAddr(seg.end - 1n, this.base.version),
			x: offsetX,
			y: offsetY,
		}
	}

	onHilbertLeave(this: AlpineThis<Calculator>): void {
		if (this.view) this.view.setHighlight(null)
		this.currentSeg = null
		this.hover = null
	}

	swatch(index: number, length: number): string {
		return colorFor(index, length)
	}

	formatBase(): string {
		return this.base ? formatNet(this.base) : ""
	}

	reset(this: AlpineThis<Calculator>): void {
		this.input.base = ""
		this.input.excludes = ""
	}

	copyOne(cidr: string): void {
		navigator.clipboard.writeText(cidr)
		toaster.show({ message: `Copied ${cidr}.`, class: "success" })
	}

	copyAll(this: AlpineThis<Calculator>): void {
		navigator.clipboard.writeText(this.cidrs.join("\n"))
		toaster.show({
			message: `Copied ${this.cidrs.length} CIDR${this.cidrs.length === 1 ? "" : "s"}.`,
			class: "success",
		})
	}
}

export default function calculator(this: AlpineThis<Calculator>): AlpineComponent<Calculator> {
	return new Calculator(this)
}
