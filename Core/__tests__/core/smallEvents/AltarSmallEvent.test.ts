import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/altar";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import { Maps } from "../../../src/core/maps/Maps";
import { PlayerSmallEvents } from "../../../src/core/database/game/models/PlayerSmallEvent";
import { LogsReadRequests } from "../../../src/core/database/logs/LogsReadRequests";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { PlayerBadgesManager } from "../../../src/core/database/game/models/PlayerBadges";
import {
	generateRandomItem, giveItemToPlayer
} from "../../../src/core/utils/ItemUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	BlessingConstants, BlessingType
} from "../../../../Lib/src/constants/BlessingConstants";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Badge } from "../../../../Lib/src/types/Badge";
import {
	ReactionCollectorAltarContributeReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorAltar";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	SmallEventAltarContributedPacket, SmallEventAltarFirstEncounterPacket, SmallEventAltarNoContributionPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventAltarPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	asPlayer, createTestPlayer, endWithoutReaction, ignoresOtherPlayers, isBlocked, packetOf, packetsOf, react, reactWith, runSmallEvent, SmallEventRun, TEST_NOW, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

const { getLifetimeContributions } = vi.hoisted(() => ({ getLifetimeContributions: vi.fn() }));

vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: { getLifetimeContributions }
	}
}));

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", async () => ({
	withLockedPlayerAndMissionsSafe: (await import("./SmallEventHarness")).lockedPlayerPassthrough
}));

vi.mock("../../../src/core/utils/ItemUtils", async importOriginal => {
	const actual = await importOriginal<typeof import("../../../src/core/utils/ItemUtils")>();
	return {
		...actual,
		generateRandomItem: vi.fn(actual.generateRandomItem),
		giveItemToPlayer: vi.fn().mockResolvedValue(undefined)
	};
});

const HOUR = 3_600_000;
const POOL_THRESHOLD = 1_000_000;

type Pool = {
	remaining: number;
	expiresIn: number;
};

function mockPool({
	remaining, expiresIn
}: Pool): BlessingManager {
	const blessingManager = BlessingManager.getInstance();
	vi.spyOn(blessingManager, "getPoolThreshold").mockReturnValue(POOL_THRESHOLD);
	vi.spyOn(blessingManager, "getPoolAmount").mockReturnValue(POOL_THRESHOLD - remaining);
	vi.spyOn(blessingManager, "getPoolExpiresAt").mockReturnValue(new Date(TEST_NOW.getTime() + expiresIn));
	return blessingManager;
}

function offeredAmounts(run: SmallEventRun): number[] {
	return (run.collector?.creationPacket.reactions ?? [])
		.filter(reaction => reaction.type === ReactionCollectorAltarContributeReaction.name)
		.map(reaction => (reaction.data as ReactionCollectorAltarContributeReaction).amount);
}

function contribute(run: SmallEventRun, amount: number): Promise<CrowniclesPacket[]> {
	return react(run, reaction => reaction.type === ReactionCollectorAltarContributeReaction.name
		&& (reaction.data as ReactionCollectorAltarContributeReaction).amount === amount);
}

describe("altar small event", () => {
	useSmallEventHarness();
	let missionUpdate: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		missionUpdate = vi.spyOn(MissionsController, "update").mockResolvedValue(undefined as never);
		vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(2);
		getLifetimeContributions.mockReset().mockResolvedValue(0);
		vi.mocked(generateRandomItem).mockClear();
		vi.mocked(giveItemToPlayer).mockClear();
	});

	describe("availability", () => {
		function canBeExecuted(): Promise<boolean> {
			return Promise.resolve(smallEventFuncs.canBeExecuted(asPlayer(createTestPlayer()), {} as never));
		}

		beforeEach(() => {
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			vi.spyOn(PlayerSmallEvents, "playerSmallEventCount").mockResolvedValue(0);
			vi.spyOn(BlessingManager.getInstance(), "canOracleAppear").mockReturnValue(true);
		});

		it("happens on the continent when the oracle can appear", async () => {
			expect(await canBeExecuted()).toBe(true);
		});

		it("does not happen outside the continent", async () => {
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(false);
			expect(await canBeExecuted()).toBe(false);
		});

		it("happens only once per path", async () => {
			vi.spyOn(PlayerSmallEvents, "playerSmallEventCount").mockResolvedValue(1);
			expect(await canBeExecuted()).toBe(false);
		});

		it("only lets a player who never met the oracle meet it while it cannot appear", async () => {
			vi.spyOn(BlessingManager.getInstance(), "canOracleAppear").mockReturnValue(false);
			vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(0);
			expect(await canBeExecuted()).toBe(true);
			expect(LogsReadRequests.getSmallEventEncounterCount).toHaveBeenCalledWith("keycloak-1", "altar");

			vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(1);
			expect(await canBeExecuted()).toBe(false);
		});
	});

	it("introduces the oracle the first time the player meets it, and counts the meeting for the missions", async () => {
		vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(1);
		const player = createTestPlayer();

		const run = await runSmallEvent(smallEventFuncs, player);

		expect(LogsReadRequests.getSmallEventEncounterCount).toHaveBeenCalledWith(player.keycloakId, "altar");
		expect(packetsOf(run.response, SmallEventAltarFirstEncounterPacket)).toHaveLength(1);
		expect(run.collector).toBeUndefined();
		expect(missionUpdate).toHaveBeenCalledWith(player, run.response, {
			missionId: "meetOracle", params: { tags: ["meetOracleAltar"] }
		});
		expect(missionUpdate).toHaveBeenCalledWith(player, run.response, {
			missionId: "meetAllOracles", params: { oracleId: "altar" }
		});
	});

	describe("offered contributions", () => {
		it("offers the flat amount, a share of the money, an amount of the level and the smart amount, sorted and capped by the pool", async () => {
			mockPool({
				remaining: 300, expiresIn: 10 * 24 * HOUR
			});

			const run = await runSmallEvent(smallEventFuncs, createTestPlayer({
				money: 10_000, level: 50
			}));

			// Smart amount: poor player, almost filled pool, plenty of time
			expect(offeredAmounts(run)).toEqual([50, 100, 200, 300]);
			expect(run.collector?.creationPacket.reactions.at(-1)?.type).toBe(ReactionCollectorRefuseReaction.name);
			expect(run.collector?.creationPacket.data.data).toMatchObject({
				poolAmount: POOL_THRESHOLD - 300, poolThreshold: POOL_THRESHOLD
			});
			expect(run.response).toContain(run.collector?.creationPacket);
			expect(await ignoresOtherPlayers(run)).toBe(true);
		});

		it("offers each amount once and at least one coin", async () => {
			mockPool({
				remaining: 100_000, expiresIn: 10 * 24 * HOUR
			});

			// The money share equals the flat amount, the level gives nothing
			const run = await runSmallEvent(smallEventFuncs, createTestPlayer({
				money: 5_000, level: 0
			}));

			expect(offeredAmounts(run)).toEqual([1, 100, 300]);
		});

		it("only offers to refuse when the pool is full", async () => {
			mockPool({
				remaining: 0, expiresIn: HOUR
			});

			const run = await runSmallEvent(smallEventFuncs, createTestPlayer());

			expect(offeredAmounts(run)).toEqual([]);
			expect(run.collector?.creationPacket.reactions).toHaveLength(1);
		});

		it.each([
			[0, 7_499, 3 * 24 * HOUR + 1, [1, 50, 100]],
			[49_999, 7_500, 3 * 24 * HOUR, [1, 100, 250, 999]],
			[0, 14_999, 36 * HOUR + 1, [1, 100, 250]],
			[50_000, 15_000, 36 * HOUR, [1, 100, 750, 1_000]],
			[99_999, 29_999, 12 * HOUR + 1, [1, 100, 750, 1_999]],
			[100_000, 30_000, 12 * HOUR, [1, 100, 1_500, 2_000]]
		])("offers a player with %i coins, when %i coins are missing to the pool expiring in %i ms, the amounts %j", async (money, remaining, expiresIn, amounts) => {
			mockPool({
				remaining, expiresIn
			});

			// A null level gives a single coin, leaving the smart amount between the flat amount and the money share
			const run = await runSmallEvent(smallEventFuncs, createTestPlayer({
				money, level: 0
			}));

			expect(offeredAmounts(run)).toEqual(amounts);
		});
	});

	describe("contribution", () => {
		let blessingManager: BlessingManager;
		let player: TestPlayer;
		let run: SmallEventRun;

		beforeEach(async () => {
			blessingManager = mockPool({
				remaining: 100_000, expiresIn: 10 * 24 * HOUR
			});
			vi.spyOn(blessingManager, "contribute").mockResolvedValue(false);
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			vi.spyOn(PlayerBadgesManager, "hasBadge").mockResolvedValue(false);
			vi.spyOn(PlayerBadgesManager, "addBadge").mockResolvedValue(true);
			player = createTestPlayer({
				money: 50_000, level: 50
			});
			run = await runSmallEvent(smallEventFuncs, player);
		});

		it.each([
			["refuses", (): Promise<CrowniclesPacket[]> => reactWith(run, ReactionCollectorRefuseReaction)],
			["does not answer", (): Promise<CrowniclesPacket[]> => endWithoutReaction(run)]
		])("takes nothing from a player who %s", async (_case, answer) => {
			const response = await answer();

			expect(packetOf(response, SmallEventAltarNoContributionPacket)).toMatchObject({
				amount: 0, newPoolAmount: POOL_THRESHOLD - 100_000, poolThreshold: POOL_THRESHOLD, hasEnoughMoney: true
			});
			expect(player.money).toBe(50_000);
			expect(blessingManager.contribute).not.toHaveBeenCalled();
			expect(isBlocked(player)).toBe(false);
		});

		it("takes nothing from a player who spent their money in the meantime", async () => {
			player.money = 999;

			const response = await contribute(run, 1_000);

			expect(packetOf(response, SmallEventAltarNoContributionPacket)).toMatchObject({
				amount: 1_000, hasEnoughMoney: false
			});
			expect(player.money).toBe(999);
			expect(blessingManager.contribute).not.toHaveBeenCalled();
			expect(isBlocked(player)).toBe(false);
		});

		it("adds the contribution of the player to the pool and to their missions", async () => {
			player.money = 1_000;

			const response = await contribute(run, 1_000);

			expect(player.money).toBe(0);
			expect(blessingManager.contribute).toHaveBeenCalledWith(1_000, player.keycloakId);
			expect(packetOf(response, SmallEventAltarContributedPacket)).toEqual(expect.objectContaining({
				amount: 1_000,
				blessingTriggered: false,
				blessingType: 0,
				newPoolAmount: POOL_THRESHOLD - 100_000,
				poolThreshold: POOL_THRESHOLD,
				bonusGems: 0,
				bonusItemGiven: false,
				badgeAwarded: false
			}));
			expect(missionUpdate).toHaveBeenCalledWith(player, response, {
				missionId: "contributeToBlessing", count: 1_000
			});
			expect(giveItemToPlayer).not.toHaveBeenCalled();
			expect(player.save).toHaveBeenCalled();
			expect(isBlocked(player)).toBe(false);
		});

		it("announces the blessing the contribution triggers", async () => {
			vi.spyOn(blessingManager, "contribute").mockResolvedValue(true);
			vi.spyOn(blessingManager, "getActiveBlessingType").mockReturnValue(BlessingType.MONEY_BOOST);

			const response = await contribute(run, 1_000);

			expect(packetOf(response, SmallEventAltarContributedPacket)).toMatchObject({
				blessingTriggered: true, blessingType: BlessingType.MONEY_BOOST
			});
		});

		it("never gives a bonus for the flat contribution", async () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);

			const response = await contribute(run, BlessingConstants.FLAT_CONTRIBUTION);

			expect(RandomUtils.crowniclesRandom.bool).not.toHaveBeenCalled();
			expect(packetOf(response, SmallEventAltarContributedPacket)).toMatchObject({
				bonusGems: 0, bonusItemGiven: false
			});
		});

		it("gives gems with a chance growing with the contribution and an item", async () => {
			const addGems = vi.fn().mockResolvedValue(undefined);
			vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({ addGems } as never);
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);

			const response = await contribute(run, 1_000);

			expect(RandomUtils.crowniclesRandom.bool).toHaveBeenNthCalledWith(1, 1_000 / BlessingConstants.CONTRIBUTION_GEMS_FULL_PROBABILITY_AMOUNT);
			expect(RandomUtils.crowniclesRandom.bool).toHaveBeenNthCalledWith(2, BlessingConstants.CONTRIBUTION_BONUS_ITEM_PROBABILITY);
			expect(addGems).toHaveBeenCalledWith(BlessingConstants.CONTRIBUTION_BONUS_GEMS_AMOUNT, player.keycloakId, NumberChangeReason.BLESSING);
			expect(packetOf(response, SmallEventAltarContributedPacket)).toMatchObject({
				bonusGems: BlessingConstants.CONTRIBUTION_BONUS_GEMS_AMOUNT, bonusItemGiven: true
			});
			expect(generateRandomItem).toHaveBeenCalledWith({ minRarity: ItemRarity.SPECIAL });
			const item = vi.mocked(generateRandomItem).mock.results[0].value;
			expect(giveItemToPlayer).toHaveBeenCalledWith(response, expect.anything(), player, item, expect.objectContaining({ itemLevel: expect.any(Number) }));
		});

		it("caps the chance of gems at certainty", async () => {
			const bigRun = await runSmallEvent(smallEventFuncs, createTestPlayer({
				money: 2_000_000, level: 50
			}));

			await contribute(bigRun, 40_000);

			expect(RandomUtils.crowniclesRandom.bool).toHaveBeenNthCalledWith(1, 1);
		});

		it("awards the patron badge when the lifetime contributions reach the threshold with this one", async () => {
			getLifetimeContributions.mockResolvedValue(BlessingConstants.ORACLE_PATRON_THRESHOLD - 1_000);

			const response = await contribute(run, 1_000);

			expect(getLifetimeContributions).toHaveBeenCalledWith(player.keycloakId);
			expect(PlayerBadgesManager.addBadge).toHaveBeenCalledWith(player.id, Badge.ORACLE_PATRON);
			expect(packetOf(response, SmallEventAltarContributedPacket).badgeAwarded).toBe(true);
		});

		it("does not award the patron badge below the threshold, nor twice", async () => {
			getLifetimeContributions.mockResolvedValue(BlessingConstants.ORACLE_PATRON_THRESHOLD - 1_001);
			expect(packetOf(await contribute(run, 1_000), SmallEventAltarContributedPacket).badgeAwarded).toBe(false);
			expect(PlayerBadgesManager.hasBadge).not.toHaveBeenCalled();

			getLifetimeContributions.mockResolvedValue(BlessingConstants.ORACLE_PATRON_THRESHOLD);
			vi.spyOn(PlayerBadgesManager, "hasBadge").mockResolvedValue(true);
			player.money = 50_000;
			const secondRun = await runSmallEvent(smallEventFuncs, player);
			expect(packetOf(await contribute(secondRun, 1_000), SmallEventAltarContributedPacket).badgeAwarded).toBe(false);
			expect(PlayerBadgesManager.addBadge).not.toHaveBeenCalled();
		});
	});
});
