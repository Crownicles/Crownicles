import {describe, expect, it, vi} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandTopPacketResScore, CommandTopPacketResGlory, CommandTopPacketResGuild} from "../../../Lib/src/packets/commands/CommandTopPacket";
import {CommandFightHistoryPacketRes} from "../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import {CommandLeagueRewardNotSundayPacketRes, CommandLeagueRewardSuccessPacketRes} from "../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import {TopTiming as CoreTiming} from "../../../Lib/src/types/TopTimings";
import {EloGameResult} from "../../../Lib/src/types/EloGameResult";
import {TopReq} from "../../../WsPackets/src/fromClient/RankingsReq";
import {TopTiming, TopDataType} from "../../../WsPackets/src/objects/Rankings";
import RankingsServerTranslator from "../../src/packets/fromServer/translators/RankingsServerTranslator";
import RankingsClientTranslator from "../../src/packets/fromClient/translators/RankingsClientTranslator";
import ProfileCommandClientTranslator from "../../src/packets/fromClient/translators/ProfileCommandClientTranslator";
import {PlayerProfileReq} from "../../../WsPackets/src/fromClient/ProfileReq";
import GuildManagementClientTranslator from "../../src/packets/fromClient/translators/GuildManagementClientTranslator";
import {GuildInvitePlayerReq} from "../../../WsPackets/src/fromClient/GuildManagementReq";
import {makeFromClientPacket} from "../../../WsPackets/src/MakePackets";
import {resolvePlayerReference} from "../../src/services/PlayerReference";

vi.mock("../../src/packets/fromServer/PlayerDisplay", () => ({resolvePlayerName: vi.fn(async () => "Aventurier")}));
const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
const PAGE = {timing: CoreTiming.ALL_TIME, canBeRanked: true, totalElements: 50, elementsPerPage: 10, pageNumber: 3, contextRank: 21};

describe("arena reference data", () => {
	it("keeps server pagination and resolves only player rankings as account names", async () => {
		const entry = {rank: 21, sameContext: true, text: "private-account"};
		const score = await RankingsServerTranslator.score(CONTEXT, makePacket(CommandTopPacketResScore, {...PAGE, elements: [{...entry, attributes: {1: {mapType: "ci", afk: false}, 2: 345, 3: 20}}]}));
		expect(score).toMatchObject({pageNumber: 3, contextRank: 21, totalElements: 50, elements: [{rank: 21, name: "Aventurier", value: 345, level: 20, afk: false}]});
		expect(JSON.stringify(score)).not.toContain("private-account");
		expect(JSON.parse(JSON.stringify(score))).not.toHaveProperty("needFight");
		const glory = await RankingsServerTranslator.glory(CONTEXT, makePacket(CommandTopPacketResGlory, {...PAGE, needFight: 2, elements: [{...entry, attributes: {1: 3, 2: 750, 3: 20}}]}));
		expect(glory.elements[0]).toMatchObject({leagueId: 3, value: 750, level: 20});
		const guild = await RankingsServerTranslator.guild(CONTEXT, makePacket(CommandTopPacketResGuild, {...PAGE, elements: [{...entry, text: "Aurore", attributes: {1: 450, 2: 12, 3: undefined}}]}));
		expect(guild.elements[0]).toEqual({rank: 21, sameContext: true, name: "Aurore", value: 450, level: 12});
	});
	it("lets a ranked player's profile be asked through an opaque handle, and a forged one find nobody", async () => {
		const score = await RankingsServerTranslator.score(CONTEXT, makePacket(CommandTopPacketResScore, {...PAGE, elements: [{rank: 2, sameContext: false, text: "private-account", attributes: {1: {afk: false}, 2: 10, 3: 5}}]}));
		const playerRef = score.elements[0].playerRef!;
		const asked = await ProfileCommandClientTranslator.other(CONTEXT, makeFromClientPacket(PlayerProfileReq, {playerRef}));
		expect(asked.askedPlayer).toEqual({keycloakId: "private-account"});
		const forged = await ProfileCommandClientTranslator.other(CONTEXT, makeFromClientPacket(PlayerProfileReq, {playerRef: `${playerRef.slice(0, -2)}AA`}));
		expect(forged.askedPlayer.keycloakId).not.toBe("private-account");
		expect(forged.askedPlayer.keycloakId).not.toBe(CONTEXT.keycloakId);
	});
	it("invites a ranked player through the same handle, and a forged one invites nobody", async () => {
		const score = await RankingsServerTranslator.score(CONTEXT, makePacket(CommandTopPacketResScore, {...PAGE, elements: [{rank: 2, sameContext: false, text: "private-account", attributes: {1: {afk: false}, 2: 10, 3: 5}}]}));
		const playerRef = score.elements[0].playerRef!;
		const invite = await GuildManagementClientTranslator.invitePlayer(CONTEXT, makeFromClientPacket(GuildInvitePlayerReq, {playerRef}));
		expect(invite.invitedPlayerKeycloakId).toBe("private-account");
		expect(invite.invitedPlayerRank).toBeUndefined();
		const forged = await GuildManagementClientTranslator.invitePlayer(CONTEXT, makeFromClientPacket(GuildInvitePlayerReq, {playerRef: `${playerRef.slice(0, -2)}AA`}));
		expect([CONTEXT.keycloakId, "private-account"]).not.toContain(forged.invitedPlayerKeycloakId);
	});
	it("returns history record IDs and never leaks the opponent account", async () => {
		const result = await RankingsServerTranslator.history(CONTEXT, makePacket(CommandFightHistoryPacketRes, {history: [{id: 42, initiator: false, opponentKeycloakId: "private-opponent", result: EloGameResult.LOSS, date: 123456, classes: {me: 1, opponent: 2}, glory: {initial: {me: 500, opponent: 600}, change: {me: -10, opponent: 15}, leaguesChanges: {}}}]}));
		expect(result.history[0]).toMatchObject({id: 42, opponentName: "Aventurier", initiator: false, result: 0, date: 123456});
		expect(JSON.stringify(result)).not.toContain("private-opponent");
		expect(resolvePlayerReference(result.history[0].opponentRef)).toBe("private-opponent");
	});
	it("preserves the claim date and the granted reward amounts", async () => {
		const date = await RankingsServerTranslator.notSunday(CONTEXT, makePacket(CommandLeagueRewardNotSundayPacketRes, {nextSunday: 1_900_000_000_000}));
		expect(date.outcome).toEqual({type: "notSunday", nextSunday: 1_900_000_000_000});
		const reward = await RankingsServerTranslator.reward(CONTEXT, makePacket(CommandLeagueRewardSuccessPacketRes, {score: 45, money: 321, xp: 123, gloryPoints: 700, oldLeagueId: 3, rank: 21}));
		expect(reward.outcome).toEqual({type: "success", score: 45, money: 321, xp: 123, gloryPoints: 700, oldLeagueId: 3, rank: 21});
	});
	it("validates requested page numbers without overriding the server page selection", async () => {
		const request = Object.assign(new TopReq(), {dataType: TopDataType.SCORE, timing: TopTiming.WEEK});
		expect(JSON.parse(JSON.stringify(await RankingsClientTranslator.top(CONTEXT, request)))).toEqual({dataType: "Score", timing: "Week"});
		expect(() => RankingsClientTranslator.top(CONTEXT, {...request, page: 1.5})).toThrow("Invalid ranking page");
	});
});
