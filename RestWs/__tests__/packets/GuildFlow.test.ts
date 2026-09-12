import {describe, expect, it, vi} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandGuildPacketRes} from "../../../Lib/src/packets/commands/CommandGuildPacket";
import {CommandGuildDailyRewardPacket} from "../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import {ReactionCollectorGuildCreate} from "../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import {GuildCreateReq} from "../../../WsPackets/src/fromClient/GuildReq";
import GuildClientTranslator from "../../src/packets/fromClient/translators/GuildClientTranslator";
import GuildServerTranslator from "../../src/packets/fromServer/translators/GuildServerTranslator";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

vi.mock("../../src/packets/fromServer/PlayerDisplay", () => ({resolvePlayerName: vi.fn(async () => "Aventurier")}));
const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
describe("guild commands", () => {
	it("authenticates creation and transports the Core confirmation price", async () => {
		expect(await GuildClientTranslator.create(CONTEXT, Object.assign(new GuildCreateReq(), {askedGuildName: "Aurore", keycloakId: "other"}))).toMatchObject({keycloakId: "authenticated", askedGuildName: "Aurore"});
		const collector = mapCollectorCreation(new ReactionCollectorGuildCreate("Aurore", 5000).creationPacket("guild", 1_900_000_000_000));
		expect(collector.data).toEqual({type: "guildCreate", data: {guildName: "Aurore", price: 5000}});
	});
	it("resolves member names and current membership without exposing account IDs", async () => {
		const packet = makePacket(CommandGuildPacketRes, {foundGuild: true, askedPlayerKeycloakId: "authenticated", data: {name: "Aurore", chiefId: 7, elderId: null, level: 1, isMaxLevel: false, experience: {value: 0, max: 10}, rank: {unranked: false, rank: 1, numberOfGuilds: 4, score: 42}, members: [{id: 7, keycloakId: "authenticated", rank: 12, score: 42, islandStatus: {isOnBoat: false, isOnPveIsland: false, isPveIslandAlly: false, cannotBeJoinedOnBoat: false}}]}});
		const result = await GuildServerTranslator.info(CONTEXT, packet);
		expect(result.data?.members[0]).toMatchObject({id: 7, name: "Aventurier", isSelf: true});
		expect(JSON.stringify(result)).not.toContain("keycloakId");
		expect(JSON.stringify(result)).not.toContain("authenticated");
	});
	it("forwards daily rewards after Core has applied them", async () => {
		const result = await GuildServerTranslator.daily(CONTEXT, makePacket(CommandGuildDailyRewardPacket, {guildName: "Aurore", money: 123, personalXp: 57, fullHeal: true, alteration: {healAmount: 5}}));
		expect(result.outcome).toEqual({type: "daily", reward: {guildName: "Aurore", money: 123, personalXp: 57, fullHeal: true, alteration: {healAmount: 5}}});
	});
});