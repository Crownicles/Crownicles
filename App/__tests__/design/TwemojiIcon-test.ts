import {render} from "@testing-library/react-native";
import {createElement} from "react";
import {twemojiAssetUrl} from "@/src/design/TwemojiIcon";
import {TwemojiText} from "@/src/design/TwemojiText";

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
		const {getByLabelText, queryByText, toJSON} = await render(
			createElement(TwemojiText, {emojiSize: 14, children: `Femelle ${femaleSymbol}`})
		);

		const image = getByLabelText(femaleSymbol);
		expect(image).toBeTruthy();
		expect(toJSON()).toEqual(
			expect.objectContaining({
				props: expect.objectContaining({
					style: expect.arrayContaining([expect.objectContaining({alignItems: "baseline"})])
				})
			})
		);
		expect(queryByText(femaleSymbol)).toBeNull();
	});
});
