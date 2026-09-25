import {render, screen} from "@testing-library/react-native";
import {ActionBanner} from "@/src/design/Sections";
import {Check} from "@/src/design/FightIcons";

describe("ActionBanner", () => {
	it("keeps a very long item name to two lines instead of growing the button", async () => {
		const label = "Acheter Potion méga incroyable de vitesse et de la foudre éternelle";
		await render(<ActionBanner icon={Check} label={label} onPress={jest.fn()} />);

		expect(screen.getByText(label).props.numberOfLines).toBe(2);
	});
});
