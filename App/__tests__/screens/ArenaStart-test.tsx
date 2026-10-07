import {fireEvent, render, screen} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import Arena from "@/app/(protected)/(tabs)/arena";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {useReportView} from "@/src/store/useReportActions";

const mockOpen = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-router", () => ({useRouter: (): object => ({push: jest.fn()})}));
jest.mock("@/src/store/usePlayerProfile", () => ({usePlayerProfile: jest.fn()}));
jest.mock("@/src/store/useReportActions", () => ({useReportView: jest.fn()}));
jest.mock("@/src/store/useClaimables", () => ({useLeagueRewardToClaim: (): number => 0}));
jest.mock("@/src/collectors/CollectorsContext", () => ({useCollectors: (): object => ({answerWithoutShowing: jest.fn()})}));
jest.mock("@/src/store/useInventoryMenus", () => ({useCommandMenus: (): object => ({pending: false, message: null, open: mockOpen})}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (): string => "", getIconOrNull: (): null => null}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {language: "fr", t: (key: string, options?: Record<string, unknown>): string => options?.level === undefined ? key : `${key}:${options.level}`}}));

const NO_EFFECT = {effect: "none", hasTimeDisplay: false, healed: false, timeLeft: 0};
const TRAVEL = {isInCity: false, effect: "sick", heal: {price: 120, canAfford: true}};

function renderArena(level: number, effect: object = NO_EFFECT, travel?: object, energy?: {value: number; max: number}): Promise<unknown> {
	const stats = energy ? {stats: {energy, attack: 1, defense: 1, speed: 1, breath: {base: 1, max: 1, regen: 1}}} : {};
	jest.mocked(usePlayerProfile).mockReturnValue({status: "ready", data: {pseudo: "Aventurier", level, badges: [], missions: {}, rank: {}, effect, ...stats}} as never);
	jest.mocked(useReportView).mockReturnValue((travel ? {status: "ready", data: {travel}} : {status: "loading"}) as never);
	return render(<QueryClientProvider client={new QueryClient()}><Arena /></QueryClientProvider>);
}

describe("arena start", () => {
	afterEach(() => jest.clearAllMocks());

	it("keeps the fight button in sight but greyed, with the level that opens fights", async () => {
		await renderArena(3);
		expect(screen.getByText("app:arena.locked:8")).toBeTruthy();
		const button = screen.getByRole("button", {name: "app:arena.start"});
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("lets a player at the fight level look for an opponent", async () => {
		await renderArena(8);
		expect(screen.queryByText("app:arena.locked:8")).toBeNull();
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.start"}));
		expect(mockOpen).toHaveBeenCalledTimes(1);
	});

	it("greys the search while the player is busy, and says so", async () => {
		await renderArena(8, {effect: "occupied", hasTimeDisplay: true, healed: false, timeLeft: 900_000});
		expect(screen.getByText("app:requirements.effect")).toBeTruthy();
		const button = screen.getByRole("button", {name: "app:arena.start"});
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("offers the cure in place of the search when the ailment can be healed", async () => {
		await renderArena(8, {effect: "sick", hasTimeDisplay: true, healed: false, timeLeft: 900_000}, TRAVEL);
		expect(screen.getByRole("button", {name: "app:adventure.quick.healWithCost"})).toBeTruthy();
		expect(screen.queryByRole("button", {name: "app:arena.start"})).toBeNull();
	});

	it("greys the search below the energy a fight needs, and says so before the tap", async () => {
		await renderArena(8, NO_EFFECT, undefined, {value: 700, max: 1000});
		expect(screen.getByText("app:arena.lowEnergy")).toBeTruthy();
		const button = screen.getByRole("button", {name: "app:arena.start"});
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("lets a player with enough energy look for an opponent", async () => {
		await renderArena(8, NO_EFFECT, undefined, {value: 800, max: 1000});
		expect(screen.queryByText("app:arena.lowEnergy")).toBeNull();
		await fireEvent.press(screen.getByRole("button", {name: "app:arena.start"}));
		expect(mockOpen).toHaveBeenCalledTimes(1);
	});
});
