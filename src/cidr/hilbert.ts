import type { Net } from "./calculator"
import { colorFor, highlightColorFor } from "./color"

const EXCLUDE_COLOR = "#27272a"
const EXCLUDE_HIGHLIGHT = "#71717a"
const BORDER_COLOR = "#09090b"
const HIGHLIGHT_BORDER = "#ffffff"
const PIXELS_PER_CELL = 4
const BORDER_PX = 2
const HIGHLIGHT_BORDER_PX = 2

export function chooseOrder(hostBits: number): number {
	if (hostBits <= 0) return 0
	return Math.min(8, Math.floor(hostBits / 2))
}

/** Standard iterative Hilbert curve d → (x, y) over a 2^order side grid. */
export function d2xy(order: number, d: number): { x: number; y: number } {
	let x = 0
	let y = 0
	let t = d
	const n = 1 << order
	for (let s = 1; s < n; s <<= 1) {
		const rx = 1 & (t >> 1)
		const ry = 1 & (t ^ rx)
		if (ry === 0) {
			if (rx === 1) {
				x = s - 1 - x
				y = s - 1 - y
			}
			const tmp = x
			x = y
			y = tmp
		}
		x += s * rx
		y += s * ry
		t >>= 2
	}
	return { x, y }
}

export type SegmentKind = "remainder" | "excluded"

export interface HilbertSegment {
	kind: SegmentKind
	net: Net
	start: bigint
	end: bigint
	color: string
	highlightColor: string
	/** Index into the remainder[] array if kind === 'remainder'. */
	remainderIndex?: number
}

export interface HilbertView {
	side: number
	pixelsPerCell: number
	segmentAt(offsetX: number, offsetY: number): HilbertSegment | null
	setHighlight(seg: HilbertSegment | null): void
}

interface InternalSegment extends HilbertSegment {
	cells: number[]
}

export function renderHilbert(
	canvas: HTMLCanvasElement,
	base: Net,
	remainder: Net[],
	removals: Net[],
): HilbertView {
	const hostBits = base.bits - base.prefix
	const order = chooseOrder(hostBits)
	const side = 1 << order
	const cellSpan = 1n << BigInt(Math.max(0, hostBits - 2 * order))
	const baseEnd = base.addr + (1n << BigInt(hostBits))

	const segs: InternalSegment[] = []
	for (const [index, n] of remainder.entries()) {
		segs.push({
			kind: "remainder",
			net: n,
			start: n.addr,
			end: n.addr + (1n << BigInt(n.bits - n.prefix)),
			color: colorFor(index, remainder.length),
			highlightColor: highlightColorFor(index, remainder.length),
			remainderIndex: index,
			cells: [],
		})
	}
	for (const n of removals) {
		const s = n.addr < base.addr ? base.addr : n.addr
		const e0 = n.addr + (1n << BigInt(n.bits - n.prefix))
		const e = e0 > baseEnd ? baseEnd : e0
		if (s < e) {
			segs.push({
				kind: "excluded",
				net: n,
				start: s,
				end: e,
				color: EXCLUDE_COLOR,
				highlightColor: EXCLUDE_HIGHLIGHT,
				cells: [],
			})
		}
	}
	segs.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))

	canvas.width = side * PIXELS_PER_CELL
	canvas.height = side * PIXELS_PER_CELL
	const ctx = canvas.getContext("2d")
	if (!ctx) {
		return {
			side,
			pixelsPerCell: PIXELS_PER_CELL,
			segmentAt: () => null,
			setHighlight: () => {},
		}
	}
	ctx.fillStyle = EXCLUDE_COLOR
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	let segIdx = 0
	const cellsTotal = side * side
	const grid = new Array<string>(cellsTotal)
	const cellToSeg = new Int32Array(cellsTotal).fill(-1)
	for (let i = 0; i < cellsTotal; i++) {
		const cellAddr = base.addr + BigInt(i) * cellSpan
		while (segIdx < segs.length && segs[segIdx].end <= cellAddr) segIdx++
		const seg = segs[segIdx]
		const matched = seg && seg.start <= cellAddr ? seg : null
		const color = matched ? matched.color : EXCLUDE_COLOR
		const { x, y } = d2xy(order, i)
		const cellPos = y * side + x
		grid[cellPos] = color
		if (matched) {
			cellToSeg[cellPos] = segIdx
			matched.cells.push(cellPos)
		}
		ctx.fillStyle = color
		ctx.fillRect(x * PIXELS_PER_CELL, y * PIXELS_PER_CELL, PIXELS_PER_CELL, PIXELS_PER_CELL)
	}

	ctx.fillStyle = BORDER_COLOR
	const ppc = PIXELS_PER_CELL
	const b = BORDER_PX
	for (let y = 0; y < side; y++) {
		for (let x = 0; x < side; x++) {
			const c = grid[y * side + x]
			if (x === side - 1 || grid[y * side + x + 1] !== c) {
				ctx.fillRect((x + 1) * ppc - b, y * ppc, b, ppc)
			}
			if (y === side - 1 || grid[(y + 1) * side + x] !== c) {
				ctx.fillRect(x * ppc, (y + 1) * ppc - b, ppc, b)
			}
			if (x === 0) ctx.fillRect(0, y * ppc, b, ppc)
			if (y === 0) ctx.fillRect(x * ppc, 0, ppc, b)
		}
	}

	const baseImage = ctx.getImageData(0, 0, canvas.width, canvas.height)
	let currentHighlight: number = -1

	function drawHighlight(segIndex: number): void {
		if (!ctx) return
		const seg = segs[segIndex]
		if (!seg) return
		ctx.fillStyle = seg.highlightColor
		for (const cellPos of seg.cells) {
			const x = cellPos % side
			const y = (cellPos - x) / side
			ctx.fillRect(x * ppc, y * ppc, ppc, ppc)
		}
		ctx.fillStyle = HIGHLIGHT_BORDER
		const hb = HIGHLIGHT_BORDER_PX
		for (const cellPos of seg.cells) {
			const x = cellPos % side
			const y = (cellPos - x) / side
			const left = x === 0 || cellToSeg[cellPos - 1] !== segIndex
			const right = x === side - 1 || cellToSeg[cellPos + 1] !== segIndex
			const top = y === 0 || cellToSeg[cellPos - side] !== segIndex
			const bottom = y === side - 1 || cellToSeg[cellPos + side] !== segIndex
			if (left) ctx.fillRect(x * ppc, y * ppc, hb, ppc)
			if (right) ctx.fillRect((x + 1) * ppc - hb, y * ppc, hb, ppc)
			if (top) ctx.fillRect(x * ppc, y * ppc, ppc, hb)
			if (bottom) ctx.fillRect(x * ppc, (y + 1) * ppc - hb, ppc, hb)
		}
	}

	return {
		side,
		pixelsPerCell: PIXELS_PER_CELL,
		segmentAt(offsetX, offsetY) {
			const rect = canvas.getBoundingClientRect()
			if (rect.width <= 0 || rect.height <= 0) return null
			const scaleX = canvas.width / rect.width
			const scaleY = canvas.height / rect.height
			const px = offsetX * scaleX
			const py = offsetY * scaleY
			const x = Math.floor(px / ppc)
			const y = Math.floor(py / ppc)
			if (x < 0 || x >= side || y < 0 || y >= side) return null
			const idx = cellToSeg[y * side + x]
			if (idx < 0) return null
			return segs[idx]
		},
		setHighlight(seg) {
			const segIndex = seg ? segs.indexOf(seg as InternalSegment) : -1
			if (segIndex === currentHighlight) return
			currentHighlight = segIndex
			if (!ctx) return
			ctx.putImageData(baseImage, 0, 0)
			if (segIndex >= 0) drawHighlight(segIndex)
		},
	}
}
