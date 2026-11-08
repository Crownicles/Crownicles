import { render } from "@testing-library/react-native";
import { createElement } from "react";
import { twemojiAssetUrl } from "@/src/design/TwemojiIcon";
import {
	inlineEmojiOffset, TwemojiText
} from "@/src/design/TwemojiText";
import {
	ArrowRight, Cannon
} from "@/src/design/FightIcons";

describe("action icons", () => {
	it.each([ArrowRight, Cannon])("renders light strokes directly on a native SVG", async Icon => {
		const { toJSON } = await render(createElement(Icon, {
			size: 20, color: "#ffffff"
		}));
		expect(toJSON()).toEqual(expect.objectContaining({
			props: expect.objectContaining({
				stroke: "#ffffff",
				accessible: false,
				bbWidth: 20,
				bbHeight: 20
			}),
			children: expect.arrayContaining([
				expect.objectContaining({
					props: expect.objectContaining({ stroke: {
						type: 0, payload: Number.parseInt("ffffffff", 16)
					} })
				})
			])
		}));
	});
});

describe("twemojiAssetUrl", () => {
	it("keeps the variation selector in the source while using the canonical asset filename", () => {
		const crossedSwords = String.fromCodePoint(0x2694, 0xfe0f);

		expect(twemojiAssetUrl(crossedSwords)).toBe(
			"https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/2694.svg"
		);
	});

	it("keeps every codepoint in a ZWJ sequence", () => {
		const officeWorker = String.fromCodePoint(0x1f9d1, 0x200d, 0x1f4bc);

		expect(twemojiAssetUrl(officeWorker)).toBe(
			"https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/1f9d1-200d-1f4bc.svg"
		);
	});

	it("renders translated emojis as image assets instead of native text", async () => {
		const femaleSymbol = String.fromCodePoint(0x26a7, 0xfe0f);
		const {
			getByLabelText, queryByText, toJSON
		} = await render(<TwemojiText emojiSize={14}>{`Femelle ${femaleSymbol}`}</TwemojiText>);

		const image = getByLabelText(femaleSymbol);
		expect(image).toBeTruthy();
		expect(toJSON()).toEqual(
			expect.objectContaining({
				children: [
					expect.objectContaining({
						type: "Text",
						children: expect.arrayContaining([
							expect.objectContaining({
								props: expect.objectContaining({ accessibilityLabel: femaleSymbol })
							})
						])
					})
				]
			})
		);
		expect(queryByText(femaleSymbol)).toBeNull();
	});
});

describe("emojis among words", () => {
	/** Where a glyph sits relative to the baseline, upwards, with Inter's capitals 0.727 of the font size tall. */
	const capitalsMiddle = (fontSize: number): number => fontSize * 0.727 / 2;

	it.each([
		[12, 12],
		[14, 14],
		[14.5, 14.5],
		[25, 30]
	])("centres a %s pt text's %s pt emoji on its capitals rather than standing it on the baseline", (fontSize, emojiSize) => {
		const emojiMiddle = emojiSize / 2 - inlineEmojiOffset({ fontSize }, emojiSize);
		expect(emojiMiddle).toBeCloseTo(capitalsMiddle(fontSize));
	});

	it("lowers each emoji of a text by what its own text size asks", async () => {
		const femaleSymbol = String.fromCodePoint(0x26a7, 0xfe0f);
		const { getByLabelText } = await render(<TwemojiText textStyle={{ fontSize: 20 }} emojiSize={20}>{femaleSymbol}</TwemojiText>);
		expect(getByLabelText(femaleSymbol).props.style).toEqual(
			expect.objectContaining({ transform: [{ translateY: inlineEmojiOffset({ fontSize: 20 }, 20) }] })
		);
		expect(inlineEmojiOffset({ fontSize: 20 }, 20)).toBeGreaterThan(0);
	});
});
