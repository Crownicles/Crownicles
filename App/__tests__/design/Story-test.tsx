import {render, screen} from "@testing-library/react-native";
import {Story} from "@/src/design/Story";
import {ChoiceAction} from "@/src/design/Sections";

describe("game prose", () => {
	it("renders Discord emphasis as emphasis instead of showing its markers", async () => {
		await render(<Story>{"Vous gagnez **40 pièces** en chemin."}</Story>);
		expect(screen.getByText("40 pièces")).toBeTruthy();
		expect(screen.queryByText(/\*\*/)).toBeNull();
	});

	it("draws game emojis with the app icon set rather than as raw text", async () => {
		await render(<Story>{"Vous perdez 10 ❤️ en chemin."}</Story>);
		expect(screen.queryByText(/❤️/)).toBeNull();
		expect(screen.getByText("Vous perdez 10 ")).toBeTruthy();
	});

	it("centers the leading game emoji beside a choice label without an inline text offset", async () => {
		const emoji = "\u{1FA99}";
		const label = `${emoji} Small reward`;
		await render(<ChoiceAction label={label} onPress={jest.fn()} />);
		expect(screen.getByRole("button", {name: label})).toHaveStyle({alignItems: "center"});
		expect(screen.getByLabelText(emoji)).toHaveStyle({transform: [{translateY: 0}]});
		expect(screen.getByText("Small reward")).toBeTruthy();
		expect(screen.queryByText(label)).toBeNull();
	});
});
