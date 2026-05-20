export function colorFor(index: number, length: number): string {
	const hue = Math.floor((index / length) * 360)
	return `oklch(0.75 0.175 ${hue})`
}

export function highlightColorFor(index: number, length: number): string {
	const hue = Math.floor((index / length) * 360)
	return `oklch(0.92 0.18 ${hue})`
}
