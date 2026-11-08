import { renderHook } from "@testing-library/react-native";
import { InventoryRes } from "ws-packets/src/fromServer/inventory/InventoryRes";
import { LeagueInfoRes } from "ws-packets/src/fromServer/fight/RankingsRes";
import { GuildRes } from "ws-packets/src/fromServer/guild/GuildRes";
import { ItemNature } from "ws-packets/src/objects/ItemNature";
import { PetRes } from "ws-packets/src/fromServer/pet/PetRes";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import { ReportTravelSummaryRes } from "ws-packets/src/fromServer/report/ReportTravelSummaryRes";
import {
	RequestState, useGameQuery
} from "@/src/store/useGameQuery";
import {
	dailyBonusClaimable, expeditionClaimable, guildDailyClaimable, leagueRewardClaimable, useTabClaimables
} from "@/src/store/useClaimables";
import {
	GAME_ENTITIES, GameEntity
} from "@/src/store/GameEntities";
import { JOURNEY_TABS } from "@/src/journey/Journey";
import { LeagueClaimant } from "@/src/display/Leagues";

jest.mock("@/src/store/useGameQuery", () => ({ useGameQuery: jest.fn() }));
jest.mock("@/src/store/MissionRewardsStore", () => ({ useMissionRewards: (): object => ({
	rewards: { missions: [] }, unannounced: 0
}) }));
jest.mock("@/src/store/useReportActions", () => ({ useReportView: (): object => ({ status: "loading" }) }));

const NOW = 1_000_000;
const MONEY_OBJECT = {
	id: 5, rarity: 1, nature: ItemNature.MONEY, power: 10
};
const ATTACK_OBJECT = {
	id: 6, rarity: 1, nature: ItemNature.ATTACK, power: 10
};
const NO_OBJECT = {
	id: 0, rarity: 0, nature: ItemNature.NONE, power: 0
};

function inventory(object: object, backupObjects: object[], dailyBonusAvailableAt: number): RequestState<InventoryRes> {
	return {
		status: "ready",
		data: {
			foundPlayer: true,
			dailyBonusAvailableAt,
			data: {
				object,
				backupObjects: backupObjects.map((display, slot) => ({
					display, slot: slot + 1
				}))
			}
		} as never
	};
}

function guild(daily?: {
	availableAt: number; blockedByIsland: boolean;
}): RequestState<GuildRes> {
	return {
		status: "ready",
		data: {
			foundGuild: daily !== undefined, ...daily ? { data: { membership: { daily } } } : {}
		} as never
	};
}

const EXPEDITION_LENGTH = 3_600_000;

function petAway(endTime: number): RequestState<PetRes> {
	return {
		status: "ready",
		data: { expeditionInProgress: {
			startTime: endTime - EXPEDITION_LENGTH, endTime
		} } as never
	};
}

const NO_EFFECT = {
	effect: "none", hasTimeDisplay: false, healed: false, timeLeft: 0
};
const OCCUPIED = {
	effect: "occupied", hasTimeDisplay: true, healed: false, timeLeft: 8_400_000
};

function profileOf(profile: Partial<ProfileRes> = {}): ProfileRes {
	return {
		level: 30, effect: NO_EFFECT, ...profile
	} as ProfileRes;
}

/** A player of level 30 free of any alteration and walking on the continent, unless the test says otherwise. */
function claimantOf(profile: Partial<ProfileRes> = {}, travel?: Partial<ReportTravelSummaryRes>): LeagueClaimant {
	return {
		profile: profileOf(profile), ...travel ? { travel: travel as ReportTravelSummaryRes } : {}
	};
}

function league(rewardAvailability: LeagueInfoRes["rewardAvailability"]): RequestState<LeagueInfoRes> {
	return {
		status: "ready", data: { rewardAvailability } as never
	};
}

/** Only the pet is known: every other tab's reward is still loading. */
function knowPet(pet: RequestState<PetRes>): void {
	jest.mocked(useGameQuery).mockImplementation(((entity: GameEntity) => entity === GAME_ENTITIES.PET ? pet : { status: "loading" }) as typeof useGameQuery);
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
		expect(dailyBonusClaimable({ status: "loading" }, NOW)).toBe(false);
	});

	it("offers the season reward only when Core says it can be claimed", () => {
		const claimant = claimantOf();
		expect(leagueRewardClaimable(league(null), claimant)).toBe(true);
		expect(leagueRewardClaimable(league({ type: "alreadyClaimed" }), claimant)).toBe(false);
		expect(leagueRewardClaimable(league({
			type: "notSunday", nextSunday: NOW
		}), claimant)).toBe(false);
		expect(leagueRewardClaimable({ status: "loading" }, claimant)).toBe(false);
	});

	it("does not point at a season reward the player could not claim right now", () => {
		expect(leagueRewardClaimable(league(null), claimantOf({ effect: OCCUPIED }))).toBe(false);
		expect(leagueRewardClaimable(league(null), claimantOf({ level: 7 }))).toBe(false);
		expect(leagueRewardClaimable(league(null), claimantOf({}, { isOnBoat: true }))).toBe(false);
		expect(leagueRewardClaimable(league(null), { profile: null })).toBe(false);
		expect(leagueRewardClaimable(league(null), claimantOf({
			effect: {
				...OCCUPIED, healed: true
			}
		}, { isOnBoat: false }))).toBe(true);
	});

	it("offers the guild reward once due, unless the island froze it or there is no guild", () => {
		expect(guildDailyClaimable(guild({
			availableAt: NOW, blockedByIsland: false
		}), NOW)).toBe(true);
		expect(guildDailyClaimable(guild({
			availableAt: NOW + 1, blockedByIsland: false
		}), NOW)).toBe(false);
		expect(guildDailyClaimable(guild({
			availableAt: NOW, blockedByIsland: true
		}), NOW)).toBe(false);
		expect(guildDailyClaimable(guild(), NOW)).toBe(false);
	});

	it("offers the expedition's finds once the pet is due back, and not before", () => {
		expect(expeditionClaimable(petAway(NOW), NOW)).toBe(true);
		expect(expeditionClaimable(petAway(NOW + 1), NOW)).toBe(false);
		expect(expeditionClaimable(petAway(NOW), 0)).toBe(false);
		expect(expeditionClaimable({
			status: "ready", data: {} as never
		}, NOW)).toBe(false);
		expect(expeditionClaimable({ status: "loading" }, NOW)).toBe(false);
	});

	it("badges the pet tab while the pet waits back from its expedition with its finds", async () => {
		knowPet(petAway(Date.now() - EXPEDITION_LENGTH));
		const back = await renderHook(() => useTabClaimables());
		expect(back.result.current[JOURNEY_TABS.PET]).toBe(1);

		knowPet(petAway(Date.now() + EXPEDITION_LENGTH));
		const away = await renderHook(() => useTabClaimables());
		expect(away.result.current[JOURNEY_TABS.PET]).toBe(0);
	});
});
