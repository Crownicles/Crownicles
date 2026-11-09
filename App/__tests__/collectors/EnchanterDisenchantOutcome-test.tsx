import {
	act, fireEvent, render, screen
} from "@testing-library/react-native";
import { EnchanterDisenchantRes } from "ws-packets/src/fromServer/report/EnchanterDisenchantRes";
import { EnchanterDisenchantOutcome } from "@/src/collectors/EnchanterDisenchantOutcome";

jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (): string => "", getIconOrNull: (): null => null
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key } }));

describe("enchanter disenchant outcome", () => {
	it("names the enchantment Mernil removed, and goes away when tapped", async () => {
		const onContinue = jest.fn();
		await render(<EnchanterDisenchantOutcome outcome={Object.assign(new EnchanterDisenchantRes(), {
			enchantmentId: "pvpAttack1", enchantmentType: "damage"
		})} onContinue={onContinue} />);

		expect(screen.getByText("app:city.disenchanted.title")).toBeTruthy();
		expect(screen.getByText("app:city.disenchanted.description {\"enchantment\":\"items:enchantments.pvpAttack1\"}")).toBeTruthy();
		await act(async () => {
			await fireEvent.press(screen.getByText("app:city.disenchanted.title"));
		});
		expect(onContinue).toHaveBeenCalled();
	});
});
