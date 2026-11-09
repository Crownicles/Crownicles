import {
	act, fireEvent, render, screen
} from "@testing-library/react-native";
import { BlacksmithEnchantmentTransferRes } from "ws-packets/src/fromServer/report/BlacksmithEnchantmentTransferRes";
import { EnchantmentTransferOutcome } from "@/src/collectors/EnchantmentTransferOutcome";

jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (): string => "", getIconOrNull: (): null => null
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key } }));

describe("blacksmith enchantment transfer outcome", () => {
	it("names the enchantment moved and its price, and goes away when tapped", async () => {
		const onContinue = jest.fn();
		await render(<EnchantmentTransferOutcome outcome={Object.assign(new BlacksmithEnchantmentTransferRes(), {
			enchantmentId: "pvpAttack1", enchantmentType: "damage", cost: 1200
		})} onContinue={onContinue} />);

		expect(screen.getByText("app:city.enchantmentTransferred.title")).toBeTruthy();
		expect(screen.getByText(/app:city\.enchantmentTransferred\.description .*items:enchantments\.pvpAttack1.*1.?200/u)).toBeTruthy();
		await act(async () => {
			await fireEvent.press(screen.getByText("app:city.enchantmentTransferred.title"));
		});
		expect(onContinue).toHaveBeenCalled();
	});
});
