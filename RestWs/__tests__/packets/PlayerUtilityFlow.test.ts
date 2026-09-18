import {describe, expect, it, vi} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {ReactionCollectorUnlock} from "../../../Lib/src/packets/interaction/ReactionCollectorUnlock";
import {ReactionCollectorJoinBoat} from "../../../Lib/src/packets/interaction/ReactionCollectorJoinBoat";
import {CommandUnlockAcceptPacketRes} from "../../../Lib/src/packets/commands/CommandUnlockPacket";
import {CommandRespawnPacketRes} from "../../../Lib/src/packets/commands/CommandRespawnPacket";
import {UnlockReq} from "../../../WsPackets/src/fromClient/PlayerUtilityReq";
import PlayerUtilityClientTranslator from "../../src/packets/fromClient/translators/PlayerUtilityClientTranslator";
import PlayerUtilityServerTranslator from "../../src/packets/fromServer/translators/PlayerUtilityServerTranslator";
import {mapCollectorDisplay} from "../../src/packets/fromServer/collectors/CollectorDisplayMapper";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

vi.mock("../../src/packets/fromServer/PlayerDisplay", () => ({resolvePlayerName: vi.fn(async () => "Aventurier")}));
const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

describe("player utility contracts", () => {
	it("shows the server bail price and public target without exposing the account", async () => {
		const result = await mapCollectorDisplay(new ReactionCollectorUnlock("private-prisoner", 321).creationPacket("bail", 1_900_000_000_000), CONTEXT);
		expect(result.data).toEqual({type: "unlockPlayer", data: {price: 321, playerName: "Aventurier"}});
		expect(result.reactions.map(reaction => reaction.type)).toEqual(["accept", "refuse"]);
		expect(JSON.stringify(result)).not.toContain("private-prisoner");
		const success = await PlayerUtilityServerTranslator.unlock(CONTEXT, makePacket(CommandUnlockAcceptPacketRes, {unlockedKeycloakId: "private-prisoner"}));
		expect(success.outcome).toEqual({type: "unlocked", playerName: "Aventurier"});
	});
	it("preserves the boat cost, energy and respawn penalty chosen by Core", async () => {
		const result = mapCollectorCreation(new ReactionCollectorJoinBoat(7, 432, 500).creationPacket("boat", 1_900_000_000_000));
		expect(result.data).toEqual({type: "joinBoat", data: {price: 7, energy: {current: 432, max: 500}}});
		const respawn = await PlayerUtilityServerTranslator.respawn(CONTEXT, makePacket(CommandRespawnPacketRes, {lostScore: 97}));
		expect(respawn.outcome).toEqual({type: "respawn", lostScore: 97});
	});
	it("accepts a rank without trusting a caller-supplied account", async () => {
		const packet = Object.assign(new UnlockReq(), {rank: 42, askedPlayer: {keycloakId: "other"}});
		expect(await PlayerUtilityClientTranslator.unlock(CONTEXT, packet)).toEqual({askedPlayer: {rank: 42}});
		expect(() => PlayerUtilityClientTranslator.unlock(CONTEXT, {...packet, rank: 0})).toThrow("Invalid prisoner rank");
	});
});
