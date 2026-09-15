import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MissionsCommand from "../../../../src/commands/mission/MissionsCommand";
import { Player } from "../../../../src/core/database/game/models/Player";
import { PlayerMissionsInfo, PlayerMissionsInfos } from "../../../../src/core/database/game/models/PlayerMissionsInfo";
import { DailyMission, DailyMissions } from "../../../../src/core/database/game/models/DailyMission";
import { MissionsController } from "../../../../src/core/missions/MissionsController";
import { CrowniclesPacket, makePacket, PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandMissionsPacketReq, CommandMissionsPacketRes } from "../../../../../Lib/src/packets/commands/CommandMissionsPacket";

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: { DISALLOWED_EFFECTS: { NOT_STARTED_OR_DEAD: [] }, WHERE: { EVERYWHERE: [] } }
}));
vi.mock("../../../../src/core/database/game/models/Player", () => ({ Player: class {}, Players: {} }));
vi.mock("../../../../src/core/database/game/models/PlayerMissionsInfo", () => ({ PlayerMissionsInfos: { getOfPlayer: vi.fn() } }));
vi.mock("../../../../src/core/database/game/models/MissionSlot", () => ({ MissionSlots: { getOfPlayer: vi.fn().mockResolvedValue([]) } }));
vi.mock("../../../../src/core/database/game/models/DailyMission", () => ({ DailyMissions: { getOrGenerate: vi.fn() } }));
vi.mock("../../../../src/core/missions/Campaign", () => ({ Campaign: { getMaxCampaignNumber: (): number => 150 } }));
vi.mock("../../../../src/core/missions/MissionsController", () => ({ MissionsController: { update: vi.fn(), prepareMissionSlots: vi.fn(() => []), prepareBaseMission: vi.fn(mission => mission) } }));

const CONTEXT: PacketContext = { keycloakId: "player", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {} };
const PLAYER = { id: 1, keycloakId: "player", hasStartedToPlay: (): boolean => true, getMissionSlotsNumber: (): number => 2 } as Player;

async function readMissions(): Promise<CommandMissionsPacketRes> {
	const response: CrowniclesPacket[] = [];
	await new MissionsCommand().execute(response, PLAYER, makePacket(CommandMissionsPacketReq, { askedPlayer: { keycloakId: "player" } }), CONTEXT);
	const result = response.find(packet => packet instanceof CommandMissionsPacketRes);
	if (!(result instanceof CommandMissionsPacketRes)) throw new Error("Missing missions response");
	return result;
}

describe("missions calendar sent to clients", () => {
	const info = { campaignProgression: 4, dailyMissionNumberDone: 0, lastDailyMissionCompleted: new Date(2026, 8, 9, 23, 59) } as PlayerMissionsInfo;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 8, 10, 23, 59));
		info.dailyMissionNumberDone = 0;
		info.lastDailyMissionCompleted = new Date(2026, 8, 9, 23, 59);
		vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue(info);
		vi.mocked(DailyMissions.getOrGenerate).mockResolvedValue({ toJSON: () => ({ missionId: "commandMission", missionObjective: 1, missionVariant: 0 }) } as DailyMission);
	});

	afterEach(() => vi.useRealTimers());

	it("sends the next server midnight and not a rolling 24-hour duration", async () => {
		const result = await readMissions();
		expect(result.dailyMission).toEqual({ completed: false, resetsAt: new Date(2026, 8, 11).valueOf() });
	});

	it("uses mission state read after the command's progress update", async () => {
		vi.mocked(MissionsController.update).mockImplementationOnce(() => {
			info.lastDailyMissionCompleted = new Date();
			info.dailyMissionNumberDone = 1;
			return Promise.resolve();
		});
		const result = await readMissions();
		expect(result.dailyMission.completed).toBe(true);
		expect(result.missions[0].numberDone).toBe(1);
	});

	it("no longer marks yesterday's completed mission as today's completion", async () => {
		info.lastDailyMissionCompleted = new Date(2026, 8, 10, 23, 58);
		expect((await readMissions()).dailyMission.completed).toBe(true);
		vi.setSystemTime(new Date(2026, 8, 11, 0, 1));
		expect((await readMissions()).dailyMission).toEqual({ completed: false, resetsAt: new Date(2026, 8, 12).valueOf() });
	});
});