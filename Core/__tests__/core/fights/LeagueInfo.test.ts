import {afterEach, describe, expect, it, vi} from "vitest";
import LeagueInfoCommand from "../../../src/commands/player/LeagueInfoCommand";
import {Player} from "../../../src/core/database/game/models/Player";
import {CrowniclesPacket} from "../../../../Lib/src/packets/CrowniclesPacket";
import {CommandLeagueInfoRes} from "../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import {LeagueDataController} from "../../../src/data/League";
import {LEAGUE_REWARD_BLOCKERS, LeagueRewardAvailability} from "../../../../Lib/src/types/LeagueRewardAvailability";

vi.mock("../../../src/core/utils/CommandUtils", () => ({commandRequires: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor, CommandUtils: {WHERE: {EVERYWHERE: []}}}));

const SUNDAY = new Date("2026-09-20T10:00:00");
const MONDAY = new Date("2026-09-21T10:00:00");

async function leagueInfo(availability: LeagueRewardAvailability): Promise<CommandLeagueInfoRes> {
	const player = {getLeague: () => LeagueDataController.instance.getById(0), getGloryPoints: () => 123, getLeagueRewardAvailability: () => Promise.resolve(availability)} as unknown as Player;
	const response: CrowniclesPacket[] = [];
	await new LeagueInfoCommand().execute(response, player);
	return response.find((value): value is CommandLeagueInfoRes => value instanceof CommandLeagueInfoRes)!;
}

describe("league catalog", () => {
	afterEach(() => vi.useRealTimers());
	it("publishes progression order and base rewards without a negative entry threshold", async () => {
		const packet = await leagueInfo(null);
		expect(packet.currentLeagueId).toBe(0);
		expect(packet.glory).toBe(123);
		expect(packet.leagues.map(league => league.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		expect(packet.leagues[0]).toMatchObject({minGloryPoints: 0, money: 250, xp: 200});
		expect(packet.leagues.at(-1)?.minGloryPoints).toBe(3200);
	});
	it("tells the frontend why the reward cannot be claimed yet", async () => {
		const packet = await leagueInfo({type: LEAGUE_REWARD_BLOCKERS.NOT_SUNDAY, nextSunday: 1_900_000_000_000});
		expect(packet.rewardAvailability).toEqual({type: "notSunday", nextSunday: 1_900_000_000_000});
		expect((await leagueInfo(null)).rewardAvailability).toBeNull();
	});
	it("reports the same schedule the reward command enforces", () => {
		vi.useFakeTimers();
		vi.setSystemTime(MONDAY);
		const player = {gloryPointsLastSeason: 400} as Player;
		expect(Player.prototype.getLeagueRewardSchedule.call(player)?.type).toBe(LEAGUE_REWARD_BLOCKERS.NOT_SUNDAY);
		expect(Player.prototype.getLeagueRewardSchedule.call(player, true)).toBeNull();
		vi.setSystemTime(SUNDAY);
		expect(Player.prototype.getLeagueRewardSchedule.call(player)).toBeNull();
		expect(Player.prototype.getLeagueRewardSchedule.call({gloryPointsLastSeason: 0} as Player)?.type).toBe(LEAGUE_REWARD_BLOCKERS.NO_POINTS);
	});
});
