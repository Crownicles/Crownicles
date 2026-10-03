import {revealOffset} from "@/src/design/KeyboardAvoidance";
import {Theme} from "@/src/design/Theme";

const MARGIN = Theme.spacing.lg;
const VISIBLE = {top: 100, bottom: 500};

describe("revealOffset", () => {
	it("leaves a form already above the keyboard where it is", () => {
		expect(revealOffset({top: 200, bottom: 400}, {top: 220, bottom: 260}, VISIBLE)).toBe(0);
	});

	it("scrolls the button under the keyboard back into sight", () => {
		expect(revealOffset({top: 300, bottom: 560}, {top: 320, bottom: 360}, VISIBLE)).toBe(560 + MARGIN - 500);
	});

	it("never pushes the field being typed in off the top", () => {
		expect(revealOffset({top: 150, bottom: 900}, {top: 160, bottom: 200}, VISIBLE)).toBe(160 - 100 - MARGIN);
	});

	it("does not scroll backwards when the field already touches the top", () => {
		expect(revealOffset({top: 90, bottom: 900}, {top: 95, bottom: 130}, VISIBLE)).toBe(0);
	});
});
