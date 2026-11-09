import {
	fireEvent, render, screen
} from "@testing-library/react-native";
import { Linking } from "react-native";
import { Story } from "@/src/design/Story";
import { ChoiceAction } from "@/src/design/Sections";

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

	it("opens a web address of the text in the browser when it is touched", async () => {
		const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
		await render(<Story>{"Plus d'informations sur les familiers sur https://guide.crownicles.com/notions-principale/familiers/ !"}</Story>);
		await fireEvent.press(screen.getByRole("link", { name: "https://guide.crownicles.com/notions-principale/familiers/" }));
		expect(openURL).toHaveBeenCalledWith("https://guide.crownicles.com/notions-principale/familiers/");
		openURL.mockRestore();
	});

	it("leaves a text without a web address untouchable", async () => {
		await render(<Story>{"Le site crownicles.com est en ligne."}</Story>);
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("centers the leading game emoji beside a choice label without an inline text offset", async () => {
		const emoji = "\u{1FA99}";
		const label = `${emoji} Small reward`;
		await render(<ChoiceAction label={label} onPress={jest.fn()} />);
		expect(screen.getByRole("button", { name: label })).toHaveStyle({ alignItems: "center" });
		expect(screen.getByLabelText(emoji)).toHaveStyle({ transform: [{ translateY: 0 }] });
		expect(screen.getByText("Small reward")).toBeTruthy();
		expect(screen.queryByText(label)).toBeNull();
	});
});
