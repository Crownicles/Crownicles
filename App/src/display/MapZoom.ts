/** Pure geometry of the map viewer, shared by its gesture worklets and its tests. */

export type Size = {width: number; height: number};
export type Point = {x: number; y: number};
export type View = {scale: number; x: number; y: number};

export const MAP_ZOOM = {min: 1, max: 6, doubleTap: 2.5, resistance: 0.3} as const;

/** The image is laid out at its exact drawn size, so panning knows where its edges are. */
export function drawnSize(frame: Size, ratio: number): Size {
	"worklet";
	if (frame.width === 0 || frame.height === 0) return {width: 0, height: 0};
	return frame.width / frame.height > ratio
		? {width: frame.height * ratio, height: frame.height}
		: {width: frame.width, height: frame.width / ratio};
}

/** How far the zoomed image may move from the centre before its edge leaves the frame's edge. */
export function panLimit(image: number, frame: number, scale: number): number {
	"worklet";
	return Math.max(0, (image * scale - frame) / 2);
}

export function clampTo(value: number, limit: number): number {
	"worklet";
	return Math.min(limit, Math.max(-limit, value));
}

/** Past a limit, a drag only moves a fraction of the finger's travel, like stretching a rubber band. */
export function resisted(value: number, delta: number, limit: number): number {
	"worklet";
	const next = value + delta;
	if (Math.abs(next) <= limit) return next;
	const outward = Math.sign(delta) === Math.sign(next);
	return outward ? value + delta * MAP_ZOOM.resistance : next;
}

/** A pinch past the zoom limits is damped the same way. */
export function resistedScale(scale: number, change: number): number {
	"worklet";
	const next = scale * change;
	const outOfRange = next > MAP_ZOOM.max || next < MAP_ZOOM.min;
	return outOfRange ? scale * (1 + (change - 1) * MAP_ZOOM.resistance) : next;
}

/** Scales around a point of the frame (relative to its centre) so that point stays under the fingers. */
export function zoomAround(view: View, focal: Point, scale: number): View {
	"worklet";
	const ratio = scale / view.scale;
	return {scale, x: focal.x - (focal.x - view.x) * ratio, y: focal.y - (focal.y - view.y) * ratio};
}

/** The closest allowed view: zoom within its limits, image edges no further than the frame's. */
export function settledView(view: View, image: Size, frame: Size): View {
	"worklet";
	const scale = Math.min(MAP_ZOOM.max, Math.max(MAP_ZOOM.min, view.scale));
	const ratio = scale / view.scale;
	return {
		scale,
		x: clampTo(view.x * ratio, panLimit(image.width, frame.width, scale)),
		y: clampTo(view.y * ratio, panLimit(image.height, frame.height, scale))
	};
}
