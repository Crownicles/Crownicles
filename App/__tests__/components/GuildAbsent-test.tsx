import {fireEvent, render, screen} from "@testing-library/react-native";
import {GuildAbsent} from "@/src/components/GuildAbsent";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({useRouter: (): object => ({push: mockPush})}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: jest.fn()}));
jest.mock("@/src/store/useInventoryMenus", () => ({useCommandMenus: (): object => ({pending: false, message: null, open: jest.fn()})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

async function renderWith(money: number): Promise<void> {
	jest.mocked(usePlayerProfile).mockReturnValue({status: "ready", data: {pseudo: "Drapht", money}} as never);
	await render(<GuildAbsent />);
}

describe("guild tab without a guild", () => {
	afterEach(() => jest.clearAllMocks());

	it("opens the founding form when the player can pay for it", async () => {
		await renderWith(10_000);
		expect(screen.queryByLabelText("app:guild.name")).toBeNull();
		await fireEvent.press(screen.getByRole("button", {name: "app:guild.absent.createWithCost"}));
		expect(screen.getByLabelText("app:guild.name")).toBeTruthy();
	});

	it("says what is missing before a poor player tries to found one", async () => {
		await renderWith(100);
		expect(screen.getByText("app:city.locks.missingMoney")).toBeTruthy();
		expect(screen.getByRole("button", {name: "app:guild.absent.createWithCost"})).toBeDisabled();
	});

	it("leads to the guilds that recruit", async () => {
		await renderWith(100);
		await fireEvent.press(screen.getByRole("button", {name: "app:guild.absent.join"}));
		expect(mockPush).toHaveBeenCalledWith("/guild/join");
	});
});
