import {render, screen} from "@testing-library/react-native";
import {Story} from "@/src/design/Story";

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
});
