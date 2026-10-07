import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {LeagueInfoRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {GuildRes} from "ws-packets/src/fromServer/guild/GuildRes";
import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {RequestState} from "@/src/store/useGameQuery";
import {dailyBonusClaimable, guildDailyClaimable, leagueRewardClaimable} from "@/src/store/useClaimables";

const NOW = 1_000_000;
const MONEY_OBJECT = {id: 5, rarity: 1, nature: ItemNature.MONEY, power: 10};
const ATTACK_OBJECT = {id: 6, rarity: 1, nature: ItemNature.ATTACK, power: 10};
const NO_OBJECT = {id: 0, rarity: 0, nature: ItemNature.NONE, power: 0};

function inventory(object: object, backupObjects: object[], dailyBonusAvailableAt: number): RequestState<InventoryRes> {
	return {status: "ready", data: {foundPlayer: true, dailyBonusAvailableAt, data: {object, backupObjects: backupObjects.map((display, slot) => ({display, slot: slot + 1}))}} as never};
}

function guild(daily?: {availableAt: number; blockedByIsland: boolean}): RequestState<GuildRes> {
	return {status: "ready", data: {foundGuild: daily !== undefined, ...daily ? {data: {membership: {daily}}} : {}} as never};
}

describe("claimable rewards", () => {
	it("offers the daily bonus once its delay ran out and an object worn or kept aside can give it", () => {
		expect(dailyBonusClaimable(inventory(MONEY_OBJECT, [], NOW), NOW)).toBe(true);
		expect(dailyBonusClaimable(inventory(MONEY_OBJECT, [], NOW + 1), NOW)).toBe(false);
		expect(dailyBonusClaimable(inventory(NO_OBJECT, [MONEY_OBJECT], NOW), NOW)).toBe(true);
		expect(dailyBonusClaimable(inventory(ATTACK_OBJECT, [ATTACK_OBJECT], NOW), NOW)).toBe(false);
	});

	it("says nothing about the daily bonus before the clock or the inventory is known", () => {
		expect(dailyBonusClaimable(inventory(MONEY_OBJECT, [], NOW), 0)).toBe(false);
		expect(dailyBonusClaimable({status: "loading"}, NOW)).toBe(false);
	});

	it("offers the season reward only when Core says it can be claimed", () => {
		const league = (rewardAvailability: LeagueInfoRes["rewardAvailability"]): RequestState<LeagueInfoRes> => ({status: "ready", data: {rewardAvailability} as never});
		expect(leagueRewardClaimable(league(null))).toBe(true);
		expect(leagueRewardClaimable(league({type: "alreadyClaimed"}))).toBe(false);
		expect(leagueRewardClaimable(league({type: "notSunday", nextSunday: NOW}))).toBe(false);
		expect(leagueRewardClaimable({status: "loading"})).toBe(false);
	});

	it("offers the guild reward once due, unless the island froze it or there is no guild", () => {
		expect(guildDailyClaimable(guild({availableAt: NOW, blockedByIsland: false}), NOW)).toBe(true);
		expect(guildDailyClaimable(guild({availableAt: NOW + 1, blockedByIsland: false}), NOW)).toBe(false);
		expect(guildDailyClaimable(guild({availableAt: NOW, blockedByIsland: true}), NOW)).toBe(false);
		expect(guildDailyClaimable(guild(), NOW)).toBe(false);
	});
});
