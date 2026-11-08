import {
	fireEvent, render, screen, waitFor
} from "@testing-library/react-native";
import {
	QueryClient, QueryClientProvider
} from "@tanstack/react-query";
import { MissionsReq } from "ws-packets/src/fromClient/MissionsReq";
import { MissionsRes } from "ws-packets/src/fromServer/missions/MissionsRes";
import {
	Mission, MISSION_TYPES
} from "ws-packets/src/objects/Mission";
import {
	Missions, MissionsContent
} from "@/src/components/Missions";
import { missionDescription } from "@/src/display/Missions";
import { GameClient } from "@/src/networking/GameClient";
import { useLocalSearchParams } from "expo-router";
import {
	GAME_ENTITIES, gameKey
} from "@/src/store/GameEntities";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
const mockRouter = { setParams: jest.fn() };
jest.mock("expo-router", () => ({
	useFocusEffect: jest.fn(),
	useLocalSearchParams: jest.fn(() => ({})),
	useRouter: (): object => mockRouter
}));
jest.mock("@/src/networking/GameClient", () => ({ GameClient: { request: jest.fn() } }));
jest.mock("@/src/store/AppState", () => require("@/src/testing/fakeAppState").fakeAppState.hooks);
jest.mock("@/src/AppIcons", () => ({ AppIcons: {
	getIcon: (path: string): string => path, getIconOrNull: (path: string): string => path
} }));
jest.mock("@/src/translations/i18n", () => ({ i18n: {
	language: "fr",
	t: (key: string | string[], options?: Record<string, unknown>): string => {
		const resolved = Array.isArray(key) ? key[0] : key;
		if (resolved === "app:profile.formats.progress") {
			return `${options?.value} / ${options?.max}`;
		}
		if (resolved === "app:missions.resetsAt") {
			return `reset ${options?.date}`;
		}
		if (resolved.startsWith("models:missions.")) {
			return `${resolved} ${options?.variantText}`;
		}
		if (resolved.startsWith("models:missionVariants.")) {
			return JSON.stringify({
				key: resolved, ...options
			});
		}
		return resolved;
	}
} }));

const NOW = Date.parse("2026-09-10T09:00:00Z");

function mission(missionType: Mission["missionType"]): Mission {
	return {
		missionType, missionId: "commandMission", missionObjective: 3, numberDone: 1, missionVariant: 0
	};
}

const KING_CHALLENGE = {
	weeklyScore: 2_500,
	tier: 1,
	thresholds: [
		2_000,
		3_100,
		4_800,
		39_400
	],
	nextResetDate: NOW + 3_600_000
};

function packet(): MissionsRes {
	return Object.assign(new MissionsRes(), {
		missions: [
			mission(MISSION_TYPES.CAMPAIGN),
			mission(MISSION_TYPES.DAILY),
			mission(MISSION_TYPES.NORMAL)
		],
		campaignProgression: 4,
		maxCampaignNumber: 150,
		maxSideMissionSlots: 2,
		dailyMission: {
			completed: true, resetsAt: NOW + 60_000
		}
	});
}

function testClient(): QueryClient {
	return new QueryClient({ defaultOptions: { queries: {
		retry: false, gcTime: Infinity
	} } });
}

describe("missions screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(useLocalSearchParams).mockReturnValue({});
	});

	it("lists what is left to do apart from the daily mission the server calls done", async () => {
		await render(<MissionsContent data={packet()} now={NOW} />);
		expect(screen.getByText("app:missions.kinds.campaign")).toBeTruthy();
		expect(screen.getByText("app:missions.kinds.side")).toBeTruthy();
		expect(screen.queryByText(/app:missions\.kinds\.daily/)).toBeNull();
		expect(screen.getByText("app:missions.dailyDone")).toBeTruthy();
		const headers = ["app:missions.todo", "app:missions.done"].map(header => JSON.stringify(screen.toJSON()).indexOf(header));
		expect(headers[0]).toBeGreaterThan(-1);
		expect(headers[0]).toBeLessThan(headers[1]);
		expect(JSON.stringify(screen.toJSON()).indexOf("app:missions.dailyDone")).toBeGreaterThan(headers[1]);
	});

	it("keeps today's mission among the things to do while it is not done, with nothing set apart", async () => {
		const data = packet();
		data.dailyMission.completed = false;
		await render(<MissionsContent data={data} now={NOW} />);
		expect(screen.getByText(/app:missions\.kinds\.daily/)).toBeTruthy();
		expect(screen.queryByText("app:missions.done")).toBeNull();
	});

	it("shows each mission's kind, deadline and progress on its line, with nothing to open", async () => {
		const data = packet();
		data.dailyMission.completed = false;
		await render(<MissionsContent data={data} now={NOW} />);
		expect(screen.getByText(/app:missions\.kinds\.daily · reset/)).toBeTruthy();
		expect(screen.getAllByText("1 / 3").length).toBeGreaterThan(0);
		await fireEvent.press(screen.getAllByRole("button")[0]);
		expect(screen.queryByTestId("detail-sheet-backdrop")).toBeNull();
	});

	it("sets a completed campaign apart and shows no empty section for secondary missions", async () => {
		const data = packet();
		data.campaignProgression = 0;
		data.missions = [mission(MISSION_TYPES.DAILY)];
		await render(<MissionsContent data={data} now={NOW} />);
		expect(screen.getByText("app:missions.campaignCompleted")).toBeTruthy();
		expect(screen.queryByText("app:missions.kinds.side")).toBeNull();
		expect(screen.getByText("app:missions.nothingToDo")).toBeTruthy();
	});

	it("shows an empty state instead of invented objectives", async () => {
		const data = packet();
		data.missions = [];
		await render(<MissionsContent data={data} now={NOW} />);
		expect(screen.getByText("app:missions.empty")).toBeTruthy();
	});

	it("formats the remaining journey from the decoded progress", () => {
		const data = {
			...mission(MISSION_TYPES.NORMAL),
			missionId: "fromPlaceToPlace",
			travel: {
				fromMap: 12,
				toMap: 33,
				time: 6,
				orderMatter: true,
				progress: {
					startTimestamp: NOW, startMap: 12
				}
			}
		};
		expect(missionDescription(data, NOW)).toContain("models:map_locations.33.name");
		expect(missionDescription(data, NOW)).toContain("fromPlaceToPlace_secondPart");
		expect(missionDescription(data, NOW + 7 * 3_600_000)).toContain('"context":"order"');
	});

	it("requests the authenticated player's missions and refreshes the profile", async () => {
		const client = new QueryClient({ defaultOptions: { queries: {
			retry: false, gcTime: Infinity
		} } });
		const invalidate = jest.spyOn(client, "invalidateQueries");
		jest.mocked(GameClient.request).mockResolvedValue({
			kind: "answer", packet: packet()
		});
		await render(<QueryClientProvider client={client}><Missions /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:missions.todo")).toBeTruthy());
		expect(GameClient.request).toHaveBeenCalledWith(expect.any(MissionsReq), MissionsRes, expect.any(Array));
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({ askedPlayer: {} });
		expect(invalidate).toHaveBeenCalledWith({ queryKey: gameKey(GAME_ENTITIES.PROFILE) });
	});

	it("puts the king's challenge on its own view next to the missions, as Discord's button does", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({
			kind: "answer", packet: Object.assign(packet(), { kingChallenge: KING_CHALLENGE })
		});
		await render(<QueryClientProvider client={testClient()}><Missions /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:missions.todo")).toBeTruthy());
		expect(screen.queryByText("app:kingChallenge.weeklyScore")).toBeNull();

		await fireEvent.press(screen.getByText("commands:missions.kingChallenge.button"));
		expect(screen.getByText("app:kingChallenge.weeklyScore")).toBeTruthy();
		expect(screen.queryByText("app:missions.todo")).toBeNull();

		await fireEvent.press(screen.getByText("app:profile.titles.missions"));
		expect(screen.getByText("app:missions.todo")).toBeTruthy();
	});

	it("opens on the king's challenge when another screen asks for it, then forgets the request", async () => {
		jest.mocked(useLocalSearchParams).mockReturnValue({ missionsView: "kingChallenge" });
		jest.mocked(GameClient.request).mockResolvedValue({
			kind: "answer", packet: Object.assign(packet(), { kingChallenge: KING_CHALLENGE })
		});
		await render(<QueryClientProvider client={testClient()}><Missions /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:kingChallenge.weeklyScore")).toBeTruthy());
		expect(mockRouter.setParams).toHaveBeenCalledWith({ missionsView: undefined });
	});

	it("offers no king's challenge when the server does not send one", async () => {
		jest.mocked(GameClient.request).mockResolvedValue({
			kind: "answer", packet: packet()
		});
		await render(<QueryClientProvider client={testClient()}><Missions /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:missions.todo")).toBeTruthy());
		expect(screen.queryByText("commands:missions.kingChallenge.button")).toBeNull();
	});

	it("allows retrying an unavailable server and then displays its response", async () => {
		const client = new QueryClient({ defaultOptions: { queries: {
			retry: false, gcTime: Infinity
		} } });
		jest.mocked(GameClient.request).mockResolvedValueOnce({ kind: "timeout" })
			.mockResolvedValueOnce({
				kind: "answer", packet: packet()
			});
		await render(<QueryClientProvider client={client}><Missions /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:common.error")).toBeTruthy());
		await fireEvent.press(screen.getByText("app:common.retry"));
		await waitFor(() => expect(screen.getByText("app:missions.todo")).toBeTruthy());
		expect(screen.queryByText("app:common.error")).toBeNull();
	});
});
