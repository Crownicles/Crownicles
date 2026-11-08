import {
	fireEvent, render, screen
} from "@testing-library/react-native";
import {
	QueryClient, QueryClientProvider
} from "@tanstack/react-query";
import Arena from "@/app/(protected)/(tabs)/arena";
import { usePlayerProfile } from "@/src/store/usePlayerProfile";
import { useReportView } from "@/src/store/useReportActions";

const mockOpen = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-router", () => ({ useRouter: (): object => ({ push: jest.fn() }) }));
jest.mock("@/src/store/usePlayerProfile", () => ({ usePlayerProfile: jest.fn() }));
jest.mock("@/src/store/useReportActions", () => ({ useReportView: jest.fn() }));
jest.mock("@/src/store/useClaimables", () => ({ useLeagueRewardToClaim: (): number => 0 }));
jest.mock("@/src/collectors/CollectorsContext", () => ({ useCollectors: (): object => ({ answerWithoutShowing: jest.fn() }) }));
jest.mock("@/src/store/useInventoryMenus", () => ({ useCommandMenus: (): object => ({
	pending: false, message: null, open: mockOpen
}) }));
jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (): string => "", getIconOrNull: (path: string): string | null => path === "other.island" || path.startsWith("classes.") ? path : null
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: {
	language: "fr", t: (key: string, options?: Record<string, unknown>): string => options?.level === undefined ? key : `${key}:${options.level}`
} }));

const NO_EFFECT = {
	effect: "none", hasTimeDisplay: false, healed: false, timeLeft: 0
};
const TRAVEL = {
	isInCity: false,
	energy: {
		show: false, current: 0, max: 0
	},
	effect: "sick",
	heal: {
		price: 120, canAfford: true
	}
};

/** On the continent the report shows the points of the journey, on a mysterious island and its boats the energy left. */
function journey(onIsland: boolean): object {
	return {
		isInCity: false,
		energy: {
			show: onIsland, current: 40, max: 100
		}
	};
}

function renderArena(level: number, effect: object = NO_EFFECT, travel?: object, energy?: {
	value: number; max: number;
}): Promise<unknown> {
	const stats = energy
		? { stats: {
			energy,
			attack: 1,
			defense: 1,
			speed: 1,
			breath: {
				base: 1, max: 1, regen: 1
			}
		} }
		: {};
	jest.mocked(usePlayerProfile).mockReturnValue({
		status: "ready",
		data: {
			pseudo: "Aventurier", level, classId: 3, badges: [], missions: {}, rank: {}, effect, ...stats
		}
	} as never);
	jest.mocked(useReportView).mockReturnValue((travel
		? {
			status: "ready", data: { travel }
		}
		: { status: "loading" }) as never);
	return render(<QueryClientProvider client={new QueryClient()}><Arena /></QueryClientProvider>);
}

describe("arena start", () => {
	afterEach(() => jest.clearAllMocks());

	it("keeps the fight button in sight but greyed, with the level that opens fights", async () => {
		await renderArena(3);
		expect(screen.getByText("app:arena.locked:8")).toBeTruthy();
		const button = screen.getByRole("button", { name: "app:arena.start" });
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("tells where friendly fights are started once fights are open, and not before", async () => {
		await renderArena(3);
		expect(screen.queryByText("app:arena.friendlyFightHint")).toBeNull();
		await renderArena(8);
		expect(screen.getByText("app:arena.friendlyFightHint")).toBeTruthy();
	});

	it("lets a player at the fight level look for an opponent", async () => {
		await renderArena(8);
		expect(screen.queryByText("app:arena.locked:8")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "app:arena.start" }));
		expect(mockOpen).toHaveBeenCalledTimes(1);
	});

	it("greys the search while the player is busy, and says so", async () => {
		await renderArena(8, {
			effect: "occupied", hasTimeDisplay: true, healed: false, timeLeft: 900_000
		});
		expect(screen.getByText("app:requirements.effect")).toBeTruthy();
		const button = screen.getByRole("button", { name: "app:arena.start" });
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("offers the cure in place of the search when the ailment can be healed", async () => {
		await renderArena(8, {
			effect: "sick", hasTimeDisplay: true, healed: false, timeLeft: 900_000
		}, TRAVEL);
		expect(screen.getByRole("button", { name: "app:adventure.quick.healWithCost" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "app:arena.start" })).toBeNull();
	});

	it("greys the search below the energy a fight needs, and says so before the tap", async () => {
		await renderArena(8, NO_EFFECT, undefined, {
			value: 700, max: 1000
		});
		expect(screen.getByText("app:arena.lowEnergy")).toBeTruthy();
		const button = screen.getByRole("button", { name: "app:arena.start" });
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("greys the search while the player explores a mysterious island, says why before the tap and wears the island instead of the class", async () => {
		await renderArena(8, NO_EFFECT, journey(true));
		expect(screen.getByText("app:arena.island")).toBeTruthy();
		expect(screen.getByLabelText("other.island")).toBeTruthy();
		expect(screen.queryByLabelText("classes.3")).toBeNull();
		const button = screen.getByRole("button", { name: "app:arena.start" });
		expect(button).toBeDisabled();
		await fireEvent.press(button);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("lets a player back on the continent look for an opponent, wearing their class again", async () => {
		await renderArena(8, NO_EFFECT, journey(false));
		expect(screen.queryByText("app:arena.island")).toBeNull();
		expect(screen.getByLabelText("classes.3")).toBeTruthy();
		await fireEvent.press(screen.getByRole("button", { name: "app:arena.start" }));
		expect(mockOpen).toHaveBeenCalledTimes(1);
	});

	it("lets a player with enough energy look for an opponent", async () => {
		await renderArena(8, NO_EFFECT, undefined, {
			value: 800, max: 1000
		});
		expect(screen.queryByText("app:arena.lowEnergy")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "app:arena.start" }));
		expect(mockOpen).toHaveBeenCalledTimes(1);
	});
});
