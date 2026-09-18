import {describe, expect, it, vi} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandGuildPacketRes} from "../../../Lib/src/packets/commands/CommandGuildPacket";
import {CommandGuildDailyRewardPacket} from "../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import {ReactionCollectorGuildCreate} from "../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import {ReactionCollectorGuildLeave} from "../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import {ReactionCollectorGuildDescription} from "../../../Lib/src/packets/interaction/ReactionCollectorGuildDescription";
import {ReactionCollectorGuildElder} from "../../../Lib/src/packets/interaction/ReactionCollectorGuildElder";
import {mapCollectorDisplay} from "../../src/packets/fromServer/collectors/CollectorDisplayMapper";
import {CommandGuildInvitePendingPacket, CommandGuildInviteAcceptPacketRes} from "../../../Lib/src/packets/commands/CommandGuildInvitePacket";
import GuildMembersServerTranslator from "../../src/packets/fromServer/translators/GuildMembersServerTranslator";
import {GuildCreateReq} from "../../../WsPackets/src/fromClient/GuildReq";
import GuildClientTranslator from "../../src/packets/fromClient/translators/GuildClientTranslator";
import GuildServerTranslator from "../../src/packets/fromServer/translators/GuildServerTranslator";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

vi.mock("../../src/packets/fromServer/PlayerDisplay", () => ({resolvePlayerName: vi.fn(async () => "Aventurier")}));
const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
describe("guild commands", () => {
	it("distinguishes a sent invitation from an accepted membership", async () => {
		const data = {invitedPlayerKeycloakId: "recipient", guildName: "Aurore"};
		const pending = await GuildMembersServerTranslator.invited(CONTEXT, makePacket(CommandGuildInvitePendingPacket, data));
		const joined = await GuildMembersServerTranslator.joined(CONTEXT, makePacket(CommandGuildInviteAcceptPacketRes, data));
		expect(pending.outcome).toEqual({type: "memberAction", action: "invited", memberName: "Aventurier", guildName: "Aurore"});
		expect(joined.outcome).toMatchObject({type: "memberAction", action: "joined"});
	});
	it("resolves the member in a promotion confirmation without leaking the account ID", async () => {
		const result = await mapCollectorDisplay(new ReactionCollectorGuildElder("Aurore", "private-target").creationPacket("promote", 1_900_000_000_000));
		expect(result.data).toEqual({type: "guildMemberAction", data: {guildName: "Aurore", action: "promote", memberName: "Aventurier"}});
		expect(JSON.stringify(result)).not.toContain("private-target");
	});
	it("preserves dissolution and description in the server confirmations", () => {
		const leave = mapCollectorCreation(new ReactionCollectorGuildLeave("Aurore", true, "").creationPacket("leave", 1_900_000_000_000));
		expect(leave.data).toEqual({type: "guildLeave", data: {guildName: "Aurore", isGuildDestroyed: true}});
		expect(leave.reactions.map(reaction => reaction.type)).toEqual(["accept", "refuse"]);
		const description = mapCollectorCreation(new ReactionCollectorGuildDescription("Nouveau texte").creationPacket("description", 1_900_000_000_000));
		expect(description.data).toEqual({type: "guildDescription", data: {description: "Nouveau texte"}});
	});
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