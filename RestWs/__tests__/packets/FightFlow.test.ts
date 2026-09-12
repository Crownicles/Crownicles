import {describe, expect, it, vi} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandFightStatusPacket} from "../../../Lib/src/packets/fights/FightStatusPacket";
import {CommandFightIntroduceFightersPacket} from "../../../Lib/src/packets/fights/FightIntroductionPacket";
import {ReactionCollectorFightChooseAction} from "../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import FightServerTranslator from "../../src/packets/fromServer/translators/FightServerTranslator";
import FightClientTranslator from "../../src/packets/fromClient/translators/FightClientTranslator";
import {FightResumeReq} from "../../../WsPackets/src/fromClient/FightReq";

vi.mock("../../src/packets/fromServer/PlayerDisplay", () => ({resolvePlayerName: vi.fn(async () => "Aventurier")}));
const CONTEXT: PacketContext = {keycloakId: "private-self", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

describe("fight protocol", () => {
	it("does not trust a fight ID or identity supplied for resume", async () => {
		const packet = await FightClientTranslator.resume(CONTEXT, Object.assign(new FightResumeReq(), {fightId: "someone-else", keycloakId: "other"}));
		expect(JSON.parse(JSON.stringify(packet))).toEqual({});
	});
	it("keeps original action positions without publishing the fighter identity", () => {
		const result = mapCollectorCreation(new ReactionCollectorFightChooseAction("duel", "private-self", ["quickAttack", "rest", "simpleAttack"]).creationPacket("choices", 1_900_000_000_000));
		expect(result.data).toEqual({type: "fightAction", data: {fightId: "duel"}});
		expect(result.reactions.map(reaction => reaction.data)).toEqual([{id: "quickAttack"}, {id: "rest"}, {id: "simpleAttack"}]);
		expect(JSON.stringify(result)).not.toContain("private-self");
	});
	it("resolves participants while preserving the current fighter and statistics", async () => {
		const stats = {power: 123, attack: 42, defense: 25, speed: 10, breath: 4, maxBreath: 12, breathRegen: 2};
		const result = await FightServerTranslator.status(CONTEXT, makePacket(CommandFightStatusPacket, {fightId: "duel", numberOfTurn: 3, maxNumberOfTurn: 30, activeFighter: {keycloakId: "private-opponent", stats}, defendingFighter: {keycloakId: "private-self", stats}}));
		expect(result.status.activeFighter.isSelf).toBe(false);
		expect(result.status.defendingFighter.isSelf).toBe(true);
		expect(result.status.activeFighter.stats).toEqual(stats);
		expect(JSON.stringify(result)).not.toContain("private-");
	});
	it("keeps monster IDs and exact action breath costs in introductions", async () => {
		const result = await FightServerTranslator.introduction(CONTEXT, makePacket(CommandFightIntroduceFightersPacket, {fightId: "pve", fightInitiatorKeycloakId: "private-self", fightOpponentMonsterId: "golem", fightInitiatorActions: [["rest", 0], ["simpleAttack", 3]], fightOpponentActions: [["charge", 5]]}));
		expect(result.introduction.opponent).toEqual({isSelf: false, monsterId: "golem"});
		expect(result.introduction.initiatorActions).toEqual([["rest", 0], ["simpleAttack", 3]]);
	});
});
