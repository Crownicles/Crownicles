import {describe, expect, it, vi} from "vitest";
import LeagueInfoCommand from "../../../src/commands/player/LeagueInfoCommand";
import {Player} from "../../../src/core/database/game/models/Player";
import {CrowniclesPacket} from "../../../../Lib/src/packets/CrowniclesPacket";
import {CommandLeagueInfoRes} from "../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import {LeagueDataController} from "../../../src/data/League";

vi.mock("../../../src/core/utils/CommandUtils", () => ({commandRequires: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor, CommandUtils: {WHERE: {EVERYWHERE: []}}}));

describe("league catalog", () => {
	it("publishes progression order and base rewards without a negative entry threshold", () => {
		const player = {getLeague: () => LeagueDataController.instance.getById(0), getGloryPoints: () => 123} as Player;
		const response: CrowniclesPacket[] = [];
		new LeagueInfoCommand().execute(response, player);
		const packet = response.find((value): value is CommandLeagueInfoRes => value instanceof CommandLeagueInfoRes)!;
		expect(packet.currentLeagueId).toBe(0);
		expect(packet.glory).toBe(123);
		expect(packet.leagues.map(league => league.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
		expect(packet.leagues[0]).toMatchObject({minGloryPoints: 0, money: 250, xp: 200});
		expect(packet.leagues.at(-1)?.minGloryPoints).toBe(3200);
	});
});
