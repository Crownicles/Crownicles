jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));

import {edgeSwipeCloses, edgeSwipeStarts} from "@/src/design/SwipeBack";

const SCREEN_WIDTH = 390;

describe("edgeSwipeStarts", () => {
	it("follows a horizontal drag born on the left edge", () => {
		expect(edgeSwipeStarts({x0: 8, dx: 30, dy: 4})).toBe(true);
	});

	it("ignores a drag started in the middle of the screen", () => {
		expect(edgeSwipeStarts({x0: 200, dx: 30, dy: 4})).toBe(false);
	});

	it("ignores a scroll disguised as a drag", () => {
		expect(edgeSwipeStarts({x0: 8, dx: 20, dy: 40})).toBe(false);
	});

	it("waits for the finger to travel before taking over", () => {
		expect(edgeSwipeStarts({x0: 8, dx: 6, dy: 0})).toBe(false);
	});
});

describe("edgeSwipeCloses", () => {
	it("closes past a third of the screen", () => {
		expect(edgeSwipeCloses({dx: SCREEN_WIDTH * 0.4, vx: 0}, SCREEN_WIDTH)).toBe(true);
	});

	it("closes on a short but fast flick", () => {
		expect(edgeSwipeCloses({dx: 40, vx: 1.2}, SCREEN_WIDTH)).toBe(true);
	});

	it("springs back when the finger barely moved", () => {
		expect(edgeSwipeCloses({dx: 40, vx: 0.1}, SCREEN_WIDTH)).toBe(false);
	});
});
