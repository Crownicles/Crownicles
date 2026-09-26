import { describe, expect, it } from "vitest";
import { makePacket, PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandMissionPlayerNotFoundPacket, CommandMissionsPacketReq, CommandMissionsPacketRes } from "../../../Lib/src/packets/commands/CommandMissionsPacket";
import { MissionType } from "../../../Lib/src/types/CompletedMission";
import { asMilliseconds } from "../../../Lib/src/types/TimeTypes";
import { MissionsReq } from "../../../WsPackets/src/fromClient/MissionsReq";
import { PlayerNotFound } from "../../../WsPackets/src/fromServer/common/PlayerNotFound";
import MissionsCommandClientTranslator from "../../src/packets/fromClient/translators/MissionsCommandClientTranslator";
import MissionsCommandServerTranslator from "../../src/packets/fromServer/translators/MissionsCommandServerTranslator";
import MissionsCompletedServerTranslator from "../../src/packets/fromServer/translators/MissionsCompletedServerTranslator";
import { MissionsCompletedPacket } from "../../../Lib/src/packets/events/MissionsCompletedPacket";
import { MissionsCompletedRes } from "../../../WsPackets/src/fromServer/missions/MissionsCompletedRes";

const CONTEXT: PacketContext = { frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {} };

describe("missions over WebSocket", () => {
	it("resolves self from the authenticated context and preserves rank lookup", async () => {
		const request = Object.assign(new MissionsReq(), { askedPlayer: {} });
		const result = await MissionsCommandClientTranslator.translate(CONTEXT, request);
		expect(result).toBeInstanceOf(CommandMissionsPacketReq);
		expect(result.askedPlayer).toEqual({ keycloakId: "authenticated-player" });
		request.askedPlayer = { rank: 7 };
		expect((await MissionsCommandClientTranslator.translate(CONTEXT, request)).askedPlayer).toEqual({ rank: 7 });
	});

	it("transports mission families and the server calendar without the player's identity", async () => {
		const packet = makePacket(CommandMissionsPacketRes, {
			keycloakId: "private-id",
			missions: Object.values(MissionType).map(missionType => ({ missionId: "commandMission", missionType, missionObjective: 3, missionVariant: 0, numberDone: 1 })),
			campaignProgression: 8,
			maxCampaignNumber: 150,
			maxSideMissionSlots: 2,
			dailyMission: { completed: true, resetsAt: asMilliseconds(1_900_000_000_000) }
		});
		const result = await MissionsCommandServerTranslator.translate(CONTEXT, JSON.parse(JSON.stringify(packet)));
		expect(result.missions.map(mission => mission.missionType)).toEqual(["sideMission", "daily", "campaign"]);
		expect(result.dailyMission).toEqual({ completed: true, resetsAt: 1_900_000_000_000 });
		expect(result).not.toHaveProperty("keycloakId");
	});

	it("decodes a journey using the shared server format", async () => {
		const saved = Buffer.alloc(10);
		saved.writeBigUInt64LE(1_900_000_000_000n);
		saved.writeUInt16LE(12, 8);
		const packet = makePacket(CommandMissionsPacketRes, {
			keycloakId: "private-id",
			missions: [{ missionId: "fromPlaceToPlace", missionType: MissionType.NORMAL, missionObjective: 1, missionVariant: 1_086_358_534, numberDone: 0, saveBlob: saved.toString("binary") }],
			campaignProgression: 0,
			maxCampaignNumber: 150,
			maxSideMissionSlots: 2,
			dailyMission: { completed: false, resetsAt: asMilliseconds(1_900_000_000_000) }
		});
		const result = await MissionsCommandServerTranslator.translate(CONTEXT, packet);
		expect(result.missions[0].travel).toEqual({ fromMap: 12, toMap: 33, time: 6, orderMatter: true, progress: { startTimestamp: 1_900_000_000_000, startMap: 12 } });
		expect(result.missions[0]).not.toHaveProperty("saveBlob");
	});

	it("returns the existing not-found state", async () => {
		expect(await MissionsCommandServerTranslator.notFound(CONTEXT, makePacket(CommandMissionPlayerNotFoundPacket, {}))).toBeInstanceOf(PlayerNotFound);
	});

	it("pushes completed missions with the rewards Core credited and the next campaign step", async () => {
		const packet = makePacket(MissionsCompletedPacket, {
			keycloakId: "private-id",
			missions: [{ missionId: "commandReport", missionType: MissionType.CAMPAIGN, missionObjective: 1, missionVariant: 0, numberDone: 1, pointsToWin: 75, xpToWin: 100, gemsToWin: 6, moneyToWin: 20, petRewardTypeId: 3 }],
			nextCampaignMission: { missionId: "travelHours", missionType: MissionType.CAMPAIGN, missionObjective: 1, missionVariant: 1, numberDone: 0 }
		});
		const result = await MissionsCompletedServerTranslator.translate(CONTEXT, JSON.parse(JSON.stringify(packet)));
		expect(result).toBeInstanceOf(MissionsCompletedRes);
		expect(result.missions).toEqual([{
			mission: { missionId: "commandReport", missionType: "campaign", missionObjective: 1, missionVariant: 0, numberDone: 1 },
			reward: { points: 75, experience: 100, gems: 6, money: 20, petRewardTypeId: 3 }
		}]);
		expect(result.nextCampaignMission?.missionId).toBe("travelHours");
		expect(result).not.toHaveProperty("keycloakId");
		expect(result).not.toHaveProperty("discoveredRecipes");
	});
});