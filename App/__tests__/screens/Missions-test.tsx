import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {MissionsReq} from "ws-packets/src/fromClient/MissionsReq";
import {MissionsRes} from "ws-packets/src/fromServer/missions/MissionsRes";
import {Mission, MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {Missions, MissionsContent} from "@/src/components/Missions";
import {missionDescription} from "@/src/display/Missions";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

jest.mock("expo-router", () => ({useFocusEffect: jest.fn()}));
jest.mock("@/src/networking/GameClient", () => ({GameClient: {request: jest.fn()}}));
jest.mock("@/src/AppIcons", () => ({AppIcons: {getIcon: (path: string): string => path}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {
	language: "fr",
	t: (key: string | string[], options?: Record<string, unknown>): string => {
		const resolved = Array.isArray(key) ? key[0] : key;
		if (resolved === "app:profile.formats.progress") return `${options?.value} / ${options?.max}`;
		if (resolved === "app:missions.resetsAt") return `reset ${options?.date}`;
		if (resolved.startsWith("models:missions.")) return `${resolved} ${options?.variantText}`;
		if (resolved.startsWith("models:missionVariants.")) return JSON.stringify({key: resolved, ...options});
		return resolved;
	}
}}));

const NOW = Date.parse("2026-09-10T09:00:00Z");

function mission(missionType: Mission["missionType"]): Mission {
	return {missionType, missionId: "commandMission", missionObjective: 3, numberDone: 1, missionVariant: 0};
}

function packet(): MissionsRes {
	return Object.assign(new MissionsRes(), {
		missions: [mission(MISSION_TYPES.CAMPAIGN), mission(MISSION_TYPES.DAILY), mission(MISSION_TYPES.NORMAL)],
		campaignProgression: 4, maxCampaignNumber: 150, maxSideMissionSlots: 2,
		dailyMission: {completed: true, resetsAt: NOW + 60_000}
	});
}

describe("missions screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("renders all families and uses the server's completed daily state", async () => {
		await render(<MissionsContent data={packet()} now={NOW} />);
		expect(screen.getByText("app:missions.campaign")).toBeTruthy();
		expect(screen.getByText("app:missions.daily")).toBeTruthy();
		expect(screen.getByText("app:missions.side")).toBeTruthy();
		expect(screen.getByText("app:missions.completed")).toBeTruthy();
		expect(screen.getByText("4 / 150")).toBeTruthy();
		expect(screen.getByText("1 / 2")).toBeTruthy();
	});

	it("keeps a mission's gauge folded until its line is opened", async () => {
		await render(<MissionsContent data={packet()} now={NOW} />);
		expect(screen.queryByText("app:missions.progress")).toBeNull();
		await fireEvent.press(screen.getAllByRole("button")[0]);
		expect(screen.getByText("app:missions.progress")).toBeTruthy();
	});

	it("renders a completed campaign and no secondary mission", async () => {
		const data = packet();
		data.campaignProgression = 0;
		data.missions = [mission(MISSION_TYPES.DAILY)];
		await render(<MissionsContent data={data} now={NOW} />);
		expect(screen.getByText("app:missions.campaignCompleted")).toBeTruthy();
		expect(screen.getByText("app:missions.noSideMissions")).toBeTruthy();
	});

	it("shows an empty state instead of invented objectives", async () => {
		const data = packet();
		data.missions = [];
		await render(<MissionsContent data={data} now={NOW} />);
		expect(screen.getByText("app:missions.empty")).toBeTruthy();
	});

	it("formats the remaining journey from the decoded progress", () => {
		const data = {...mission(MISSION_TYPES.NORMAL), missionId: "fromPlaceToPlace", travel: {fromMap: 12, toMap: 33, time: 6, orderMatter: true, progress: {startTimestamp: NOW, startMap: 12}}};
		expect(missionDescription(data, NOW)).toContain("models:map_locations.33.name");
		expect(missionDescription(data, NOW)).toContain("fromPlaceToPlace_secondPart");
		expect(missionDescription(data, NOW + 7 * 3_600_000)).toContain('"context":"order"');
	});

	it("requests the authenticated player's missions and refreshes the profile", async () => {
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		const invalidate = jest.spyOn(client, "invalidateQueries");
		jest.mocked(GameClient.request).mockResolvedValue({kind: "answer", packet: packet()});
		await render(<QueryClientProvider client={client}><Missions /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:missions.daily")).toBeTruthy());
		expect(GameClient.request).toHaveBeenCalledWith(expect.any(MissionsReq), MissionsRes, expect.any(Array));
		expect(jest.mocked(GameClient.request).mock.calls[0][0]).toMatchObject({askedPlayer: {}});
		expect(invalidate).toHaveBeenCalledWith({queryKey: gameKey(GAME_ENTITIES.PROFILE)});
	});

	it("allows retrying an unavailable server and then displays its response", async () => {
		const client = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}});
		jest.mocked(GameClient.request).mockResolvedValueOnce({kind: "timeout"}).mockResolvedValueOnce({kind: "answer", packet: packet()});
		await render(<QueryClientProvider client={client}><Missions /></QueryClientProvider>);
		await waitFor(() => expect(screen.getByText("app:common.error")).toBeTruthy());
		await fireEvent.press(screen.getByText("app:common.retry"));
		await waitFor(() => expect(screen.getByText("app:missions.daily")).toBeTruthy());
		expect(screen.queryByText("app:common.error")).toBeNull();
	});
});