import {describe, expect, it, vi} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandFightStatusPacket} from "../../../Lib/src/packets/fights/FightStatusPacket";
import {CommandFightIntroduceFightersPacket} from "../../../Lib/src/packets/fights/FightIntroductionPacket";
import {ReactionCollectorFightChooseAction} from "../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import FightServerTranslator from "../../src/packets/fromServer/translators/FightServerTranslator";
import FightClientTranslator from "../../src/packets/fromClient/translators/FightClientTranslator";
import {FightResumeReq, FriendlyFightReq} from "../../../WsPackets/src/fromClient/FightReq";
import {CommandFriendlyFightErrorPacketRes, FRIENDLY_FIGHT_ERRORS} from "../../../Lib/src/packets/commands/CommandFriendlyFightPacket";
import {playerReference} from "../../src/services/PlayerReference";
import {CommandFightHistoryItemPacket} from "../../../Lib/src/packets/fights/FightHistoryItemPacket";
import {KingGuardFightRewardPacket} from "../../../Lib/src/packets/fights/KingGuardFightRewardPacket";
import {FightConstants} from "../../../Lib/src/constants/FightConstants";
import {resolvePlayerName} from "../../src/packets/fromServer/PlayerDisplay";

vi.mock("../../src/packets/fromServer/PlayerDisplay", () => ({resolvePlayerName: vi.fn(async () => "Aventurier")}));
const CONTEXT: PacketContext = {keycloakId: "private-self", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

describe("fight protocol", () => {
	it("does not trust a fight ID or identity supplied for resume", async () => {
		const packet = await FightClientTranslator.resume(CONTEXT, Object.assign(new FightResumeReq(), {fightId: "someone-else", keycloakId: "other"}));
		expect(JSON.parse(JSON.stringify(packet))).toEqual({});
	});
	it("keeps original action positions without publishing the fighter identity", () => {
		const result = mapCollectorCreation(new ReactionCollectorFightChooseAction("duel", "private-self", [{id: "quickAttack"}, {id: "rest"}, {id: "darkAttack", powerMultiplier: 0.8}]).creationPacket("choices", 1_900_000_000_000));
		expect(result.data).toEqual({type: "fightAction", data: {fightId: "duel"}});
		expect(result.reactions.map(reaction => reaction.data)).toEqual([{id: "quickAttack"}, {id: "rest"}, {id: "darkAttack", powerMultiplier: 0.8}]);
		expect(JSON.stringify(result)).not.toContain("private-self");
	});
	it("resolves participants while preserving the current fighter and statistics", async () => {
		const stats = {power: 123, attack: 42, defense: 25, speed: 10, breath: 4, maxBreath: 12, breathRegen: 2};
		const result = await FightServerTranslator.status(CONTEXT, makePacket(CommandFightStatusPacket, {fightId: "duel", numberOfTurn: 3, maxNumberOfTurn: 30, activeFighter: {keycloakId: "private-opponent", classId: 2, level: 45, alteration: "burned", stats}, defendingFighter: {keycloakId: "private-self", classId: 1, level: 30, stats}}));
		expect(result.status.activeFighter.isSelf).toBe(false);
		expect(result.status.defendingFighter.isSelf).toBe(true);
		expect(result.status.activeFighter.stats).toEqual(stats);
		expect(result.status.activeFighter).toMatchObject({classId: 2, level: 45, alteration: "burned"});
		expect(result.status.defendingFighter).toMatchObject({classId: 1, level: 30});
		expect(JSON.stringify(result)).not.toContain("private-");
	});
	it("names a king guard by its role, never as a player account to resolve", async () => {
		vi.mocked(resolvePlayerName).mockClear();
		const result = await FightServerTranslator.introduction(CONTEXT, makePacket(CommandFightIntroduceFightersPacket, {fightId: "guard", fightInitiatorKeycloakId: "private-self", fightOpponentKeycloakId: FightConstants.KING_GUARD.KEYCLOAK_ID, fightInitiatorActions: [], fightOpponentActions: []}));
		expect(result.introduction.opponent).toEqual({isSelf: false, isKingGuard: true});
		expect(resolvePlayerName).not.toHaveBeenCalledWith(FightConstants.KING_GUARD.KEYCLOAK_ID);
	});
	it("ends a king guard fight on its rewards, with no glory ranking", async () => {
		const own = {loveChange: 2, reactionType: "loveGain", petId: 1, petSex: "f", petNickname: "Milo", keycloakId: "private-self"};
		const result = await FightServerTranslator.kingGuardReward(CONTEXT, makePacket(KingGuardFightRewardPacket, {points: 35, money: 42, draw: false, won: true, petLoveChange: own}));
		expect(result.reward).toEqual({points: 35, money: 42, draw: false, won: true, petLoveChange: {loveChange: 2, reactionType: "loveGain", petId: 1, petSex: "f", petNickname: "Milo"}});
	});
	it("keeps monster IDs and exact action breath costs in introductions", async () => {
		const result = await FightServerTranslator.introduction(CONTEXT, makePacket(CommandFightIntroduceFightersPacket, {fightId: "pve", fightInitiatorKeycloakId: "private-self", fightOpponentMonsterId: "golem", fightInitiatorActions: [["rest", 0], ["simpleAttack", 3]], fightOpponentActions: [["charge", 5]]}));
		expect(result.introduction.opponent).toEqual({isSelf: false, monsterId: "golem"});
		expect(result.introduction.initiatorActions).toEqual([["rest", 0], ["simpleAttack", 3]]);
	});
	it("transports the exact post-action state without leaking identities in the nested snapshot", async () => {
		const stats = {power: 73, maxEnergy: 100, attack: 42, defense: 25, speed: 10, breath: 4, maxBreath: 12, breathRegen: 2};
		const result = await FightServerTranslator.log(CONTEXT, makePacket(CommandFightHistoryItemPacket, {
			fightId: "duel", fighterKeycloakId: "private-self", fightActionId: "canonAttack", status: "critical",
			fightActionEffectDealt: {damages: 27}, stateAfter: {
				fightId: "duel", numberOfTurn: 3, maxNumberOfTurn: 30,
				activeFighter: {keycloakId: "private-self", stats: {...stats, power: 100}},
				defendingFighter: {keycloakId: "private-opponent", stats}
			}
		}));
		expect(result.entry.stateAfter).toMatchObject({activeFighter: {isSelf: true, stats: {power: 100}}, defendingFighter: {isSelf: false, stats: {power: 73}}});
		expect(result.entry.fightActionEffectDealt?.damages).toBe(27);
		expect(JSON.stringify(result)).not.toContain("private-");
	});
	it("aims a friendly fight at the player behind the reference, never at the requester", async () => {
		const packet = await FightClientTranslator.friendly(CONTEXT, Object.assign(new FriendlyFightReq(), {playerRef: playerReference("private-opponent")}));
		expect(packet.askedPlayer).toEqual({keycloakId: "private-opponent"});
		const forged = await FightClientTranslator.friendly(CONTEXT, Object.assign(new FriendlyFightReq(), {playerRef: "forged"}));
		expect(forged.askedPlayer.keycloakId).not.toBe(CONTEXT.keycloakId);
		expect(forged.askedPlayer.rank).toBeUndefined();
	});
	it("tells the app a fight is friendly, and only then", async () => {
		const base = {fightId: "duel", fightInitiatorKeycloakId: "private-self", fightOpponentKeycloakId: "private-opponent", fightInitiatorActions: [], fightOpponentActions: []};
		const friendly = await FightServerTranslator.introduction(CONTEXT, makePacket(CommandFightIntroduceFightersPacket, {...base, friendly: true, levelCap: 100}));
		const ranked = await FightServerTranslator.introduction(CONTEXT, makePacket(CommandFightIntroduceFightersPacket, base));
		expect(friendly.introduction).toMatchObject({friendly: true, levelCap: 100});
		expect(ranked.introduction).not.toHaveProperty("friendly");
		expect(ranked.introduction).not.toHaveProperty("levelCap");
	});
	it("forwards why a friendly fight could not start", async () => {
		const result = await FightServerTranslator.friendlyError(CONTEXT, makePacket(CommandFriendlyFightErrorPacketRes, {error: FRIENDLY_FIGHT_ERRORS.OPPONENT_LEVEL_TOO_LOW}));
		expect(result.error).toBe(FRIENDLY_FIGHT_ERRORS.OPPONENT_LEVEL_TOO_LOW);
	});
});
