import {panLimit, resisted, resistedScale, settledView, zoomAround} from "@/src/display/MapZoom";

const FRAME = {width: 400, height: 800};
const IMAGE = {width: 400, height: 300};

describe("map zoom geometry", () => {
	it("keeps the pinched point under the fingers while zooming", () => {
		const focal = {x: 100, y: -50};
		const zoomed = zoomAround({scale: 1, x: 0, y: 0}, focal, 3);

		// The image point under the fingers, before and after.
		expect((focal.x - zoomed.x) / zoomed.scale).toBeCloseTo(focal.x / 1);
		expect((focal.y - zoomed.y) / zoomed.scale).toBeCloseTo(focal.y / 1);
	});

	it("lets the image move only as far as its zoomed edge reaches the frame", () => {
		expect(panLimit(IMAGE.width, FRAME.width, 1)).toBe(0);
		expect(panLimit(IMAGE.width, FRAME.width, 3)).toBe(400);
		expect(panLimit(IMAGE.height, FRAME.height, 2)).toBe(0);
	});

	it("follows the finger freely inside the limits and stretches past them", () => {
		expect(resisted(0, 50, 100)).toBe(50);
		expect(resisted(100, 50, 100)).toBe(115);
		expect(resisted(130, -20, 100)).toBe(110);
	});

	it("damps a pinch past the zoom limits", () => {
		expect(resistedScale(2, 1.5)).toBe(3);
		expect(resistedScale(6, 2)).toBeCloseTo(7.8);
		expect(resistedScale(1, 0.5)).toBeCloseTo(0.85);
	});

	it("eases back to the closest allowed view once released", () => {
		expect(settledView({scale: 0.7, x: 40, y: 20}, IMAGE, FRAME)).toEqual({scale: 1, x: 0, y: 0});
		expect(settledView({scale: 7, x: 5_000, y: 0}, IMAGE, FRAME)).toEqual({scale: 6, x: 1_000, y: 0});
		expect(settledView({scale: 6, x: 0, y: 900}, IMAGE, FRAME)).toEqual({scale: 6, x: 0, y: 500});
	});
});
