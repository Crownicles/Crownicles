import {
	act, fireEvent, render, screen, waitFor
} from "@testing-library/react-native";
import { captureRef } from "react-native-view-shot";
import {
	isAvailableAsync, shareAsync
} from "expo-sharing";
import {
	MemorableMomentOverlay, momentContent
} from "@/src/components/MemorableMoment";
import {
	MEMORABLE_MOMENT_KINDS, memorableMomentStore
} from "@/src/store/MemorableMomentStore";
import { fightStore } from "@/src/store/FightStore";
import {
	BOSS_MOMENT_PALETTES, MOMENT_PALETTES
} from "@/src/design/Theme";

const mockAnnouncementTurn = jest.fn((): boolean => true);
const mockAppStateChange = jest.fn();
const mockAppState = { current: {
	status: "ready",
	data: {
		seen: [], reveals: [] as object[], unrevealedBadges: [] as string[]
	}
} };
const mockProfile = { current: {
	status: "ready",
	data: {
		pseudo: "Drapht", badges: [] as string[]
	}
} };

jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn(async (): Promise<string> => "file:///tmp/moment.png") }));
jest.mock("expo-sharing", () => ({
	isAvailableAsync: jest.fn(async (): Promise<boolean> => true), shareAsync: jest.fn(async (): Promise<void> => undefined)
}));
jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (path: string): string => path, getIconOrNull: (): null => null
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: {
	language: "fr", t: (key: string, options?: Record<string, unknown>): string => options ? `${key} ${JSON.stringify(options)}` : key
} }));
jest.mock("@/src/components/useToastTurn", () => ({ useAnnouncementTurn: (): boolean => mockAnnouncementTurn() }));
jest.mock("@/src/store/usePlayerProfile", () => ({ usePlayerProfile: (): object => mockProfile.current }));
jest.mock("@/src/store/AppState", () => ({
	useAppState: (): object => mockAppState.current, useAppStateChange: (): jest.Mock => mockAppStateChange
}));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: (): object => ({ invalidateQueries: async (): Promise<void> => undefined }) }));

const RECORD = {
	monsterId: "magmaTitan", monsterLevel: 142, classId: 7, previousLevel: 130
};

// The store remembers the reveals it queued for the whole session, so each test keeps its own ids.
let nextRevealId = 100;

/** Core kept a boss record for the app, as it does when the fight ended while the app was closed. */
function keptRecord(): number {
	const id = nextRevealId++;
	mockAppState.current = {
		status: "ready",
		data: {
			seen: [],
			reveals: [
				{
					id,
					memorable: {
						at: 0, bossRecord: RECORD
					}
				}
			],
			unrevealedBadges: []
		}
	};
	return id;
}

describe("memorable moments", () => {
	beforeEach((): void => {
		while (memorableMomentStore.getSnapshot()) {
			memorableMomentStore.dismiss();
		}
		fightStore.reset();
		mockAnnouncementTurn.mockReturnValue(true);
		mockAppState.current = {
			status: "ready",
			data: {
				seen: [], reveals: [], unrevealedBadges: []
			}
		};
		mockProfile.current = {
			status: "ready",
			data: {
				pseudo: "Drapht", badges: []
			}
		};
		jest.clearAllMocks();
	});

	it("celebrates a badge Core says no device celebrated yet, then tells Core so every other device skips it", async () => {
		mockAppState.current = {
			status: "ready",
			data: {
				seen: [], reveals: [], unrevealedBadges: ["oracle_patron", "donor"]
			}
		};
		mockProfile.current = {
			status: "ready",
			data: {
				pseudo: "Drapht",
				badges: [
					"oracle_patron",
					"donor",
					"rich"
				]
			}
		};
		await render(<MemorableMomentOverlay />);

		expect(mockAppStateChange).toHaveBeenCalledWith({ revealedBadges: ["donor"] });
		expect(mockAppStateChange).not.toHaveBeenCalledWith({ revealedBadges: ["oracle_patron"] });
		expect(screen.getByText("app:reference.badges.names.oracle_patron")).toBeTruthy();
		expect(screen.getByText(/"owned":2/u)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("moment-continue"));

		expect(mockAppStateChange).toHaveBeenCalledWith({ revealedBadges: ["oracle_patron"] });
		expect(screen.queryByTestId("memorable-moment")).toBeNull();
	});

	it("names the record beaten, or the first win of the class", () => {
		const base = {
			kind: MEMORABLE_MOMENT_KINDS.BOSS_RECORD, at: 0, revealId: 1
		} as const;

		expect(momentContent({
			...base, record: RECORD
		}).record?.caption).toBe("app:moments.previousRecord {\"level\":130}");
		expect(momentContent({
			...base,
			record: {
				...RECORD, previousLevel: undefined
			}
		}).record?.caption).toBe("app:moments.firstWin");
	});

	it("tints the card with the boss's lair or the mythical gem, and falls back on the logo's colours", () => {
		const boss = {
			kind: MEMORABLE_MOMENT_KINDS.BOSS_RECORD, at: 0, revealId: 1
		} as const;

		expect(momentContent({
			...boss, record: RECORD
		}).palette).toBe(BOSS_MOMENT_PALETTES.magmaTitan);
		expect(momentContent({
			...boss,
			record: {
				...RECORD, monsterId: "futureBoss"
			}
		}).palette).toBe(MOMENT_PALETTES.brand);
		expect(momentContent({
			kind: MEMORABLE_MOMENT_KINDS.BADGE, badge: "rich", owned: 1, total: 29, at: 0
		}).palette).toBe(MOMENT_PALETTES.brand);
	});

	it("shows the card of a boss record Core kept, signed with the player's name, shares it, and tells Core once closed", async () => {
		const id = keptRecord();
		await render(<MemorableMomentOverlay />);

		expect(screen.getByText("models:monsters.magmaTitan.name")).toBeTruthy();
		expect(screen.getByText("Drapht")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:moments.share"));

		await waitFor(() => expect(shareAsync).toHaveBeenCalledWith("file:///tmp/moment.png", expect.objectContaining({ mimeType: "image/png" })));
		expect(captureRef).toHaveBeenCalledTimes(1);
		expect(mockAppStateChange).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByTestId("moment-continue"));

		expect(mockAppStateChange).toHaveBeenCalledWith({ acknowledged: [id] });
	});

	it("says so when the device cannot share, and lets the player move on", async () => {
		jest.mocked(isAvailableAsync).mockResolvedValueOnce(false);
		const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
		keptRecord();
		await render(<MemorableMomentOverlay />);

		await fireEvent.press(screen.getByText("app:moments.share"));
		expect(await screen.findByText("app:moments.shareFailed")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("moment-continue"));

		expect(screen.queryByTestId("memorable-moment")).toBeNull();
		expect(memorableMomentStore.getSnapshot()).toBeNull();
		warn.mockRestore();
	});

	it("waits for the fight screen and the other announcements before showing up", async () => {
		mockAnnouncementTurn.mockReturnValue(false);
		keptRecord();
		await render(<MemorableMomentOverlay />);
		expect(screen.queryByTestId("memorable-moment")).toBeNull();

		mockAnnouncementTurn.mockReturnValue(true);
		await act(async () => fightStore.show());
		expect(screen.queryByTestId("memorable-moment")).toBeNull();

		await act(async () => fightStore.reset());
		expect(screen.getByTestId("memorable-moment")).toBeTruthy();
	});
});
