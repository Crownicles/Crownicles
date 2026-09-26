import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {ReactionCollectorPveFight} from "../../../Lib/src/packets/interaction/ReactionCollectorPveFight";
import {
	CommandReportErrorNoMonsterRes, CommandReportMonsterRewardRes, CommandReportRefusePveFightRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS} from "../../../WsPackets/src/fromServer/collectors";
import {FightMonsterRewardRes} from "../../../WsPackets/src/fromServer/fight/FightRes";
import {ReportPveFightRefusedRes, ReportPveNoMonsterRes} from "../../../WsPackets/src/fromServer/report/ReportPveFightRes";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import {getServerTranslator} from "../../src/packets/fromServer/FromServerTranslator";
import FightServerTranslator from "../../src/packets/fromServer/translators/FightServerTranslator";
import "../../src/packets/fromServer/translators/ReportPveFightServerTranslator";

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}};
const MONSTER = {id: "forestTroll", level: 42, energy: 1500, attack: 310, defense: 180, speed: 90};

describe("island boss encounter", () => {
	it("offers the boss with the stats Core computed, then a start and a wait choice", () => {
		const packet = new ReactionCollectorPveFight({monster: MONSTER, mapId: 1001}).creationPacket("collector-1", 1_700_000_000_000);

		const mapped = mapCollectorCreation(packet);

		expect(mapped.data).toStrictEqual({type: REPORT_COLLECTOR_DATA_KINDS.PVE_FIGHT, data: {monster: MONSTER, mapId: 1001}});
		expect(mapped.reactions.map(reaction => reaction.type)).toStrictEqual([GENERIC_REACTION_KINDS.ACCEPT, GENERIC_REACTION_KINDS.REFUSE]);
	});

	it("tells the app when the player hid or when no boss could be found", () => {
		expect(getServerTranslator(CommandReportRefusePveFightRes.name)?.protoName).toBe(ReportPveFightRefusedRes.wireName);
		expect(getServerTranslator(CommandReportErrorNoMonsterRes.name)?.protoName).toBe(ReportPveNoMonsterRes.wireName);
	});

	it("hands over the boss loot without inventing empty sections", async () => {
		expect(getServerTranslator(CommandReportMonsterRewardRes.name)?.protoName).toBe(FightMonsterRewardRes.wireName);

		const result = await FightServerTranslator.monsterReward(CONTEXT, makePacket(CommandReportMonsterRewardRes, {
			money: 120,
			experience: 340,
			guildXp: 0,
			guildPoints: 15,
			materialLoot: []
		}));

		expect(JSON.parse(JSON.stringify(result))).toEqual({reward: {money: 120, experience: 340, guildXp: 0, guildPoints: 15}});
	});
});
