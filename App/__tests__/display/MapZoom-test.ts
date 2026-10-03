import {panLimits, resistedMove, resistedScale, settledView, zoomAround} from "@/src/display/MapZoom";

const FRAME = {width: 400, height: 800};
const IMAGE = {width: 400, height: 300};
const LAYOUT = {image: IMAGE, frame: FRAME};

describe("map zoom geometry", () => {
	it("keeps the pinched point under the fingers while zooming", () => {
		const focal = {x: 100, y: -50};
		const zoomed = zoomAround({scale: 1, x: 0, y: 0}, focal, 3);

		// The image point under the fingers, before and after.
		expect((focal.x - zoomed.x) / zoomed.scale).toBeCloseTo(focal.x / 1);
		expect((focal.y - zoomed.y) / zoomed.scale).toBeCloseTo(focal.y / 1);
	});

	it("lets the image move only as far as its zoomed edge reaches the frame", () => {
		expect(panLimits(LAYOUT, 1)).toEqual({x: 0, y: 0});
		expect(panLimits(LAYOUT, 3)).toEqual({x: 400, y: 50});
		expect(panLimits(LAYOUT, 2).y).toBe(0);
	});

	it("follows the finger freely inside the limits and stretches past them", () => {
		const limits = {x: 100, y: 100};
		expect(resistedMove({x: 0, y: 0}, {x: 50, y: 0}, limits)).toEqual({x: 50, y: 0});
		expect(resistedMove({x: 100, y: 0}, {x: 50, y: 0}, limits).x).toBe(115);
		expect(resistedMove({x: 130, y: 0}, {x: -20, y: 0}, limits).x).toBe(110);
	});

	it("damps a pinch past the zoom limits", () => {
		expect(resistedScale(2, 1.5)).toBe(3);
		expect(resistedScale(6, 2)).toBeCloseTo(7.8);
		expect(resistedScale(1, 0.5)).toBeCloseTo(0.85);
	});

	it("eases back to the closest allowed view once released", () => {
		expect(settledView({scale: 0.7, x: 40, y: 20}, LAYOUT)).toEqual({scale: 1, x: 0, y: 0});
		expect(settledView({scale: 7, x: 5_000, y: 0}, LAYOUT)).toEqual({scale: 6, x: 1_000, y: 0});
		expect(settledView({scale: 6, x: 0, y: 900}, LAYOUT)).toEqual({scale: 6, x: 0, y: 500});
	});
});
