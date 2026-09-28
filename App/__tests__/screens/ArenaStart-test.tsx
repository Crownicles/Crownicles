import {fireEvent, render, screen} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import Arena from "@/app/(protected)/(tabs)/arena";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

const mockOpen = jest.fn();

jest.mock("expo-router", () => ({useRouter: (): object => ({push: jest.fn()})}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: jest.fn()}));
jest.mock("@/src/store/useInventoryMenus", () => ({useCommandMenus: (): object => ({pending: false, message: null, open: mockOpen})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {language: "fr", t: (key: string, options?: Record<string, unknown>): string => options?.level === undefined ? key : `${key}:${options.level}`}}));

function profileAt(level: number): Promise<unknown> {
	jest.mocked(usePlayerProfile).mockReturnValue({status: "ready", data: {pseudo: "Aventurier", level, badges: [], missions: {}, rank: {}}} as never);
	return render(<QueryClientProvider client={new QueryClient()}><Arena /></QueryClientProvider>);
}

describe("arena start", () => {
	afterEach(() => jest.clearAllMocks());

	it("keeps the fight button in sight but greyed, with the level that opens fights", async () => {
		await profileAt(3);
		expect(screen.getByText("app:arena.locked:8")).toBeTruthy();
		const button = screen.getByRole("button", {name: "app:arena.start"});
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("lets a player at the fight level look for an opponent", async () => {
		await profileAt(8);
		expect(screen.queryByText("app:arena.locked:8")).toBeNull();
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.start"}));
		expect(mockOpen).toHaveBeenCalledTimes(1);
	});
});
