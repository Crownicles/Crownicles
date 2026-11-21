import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

const doubles = vi.hoisted(() => ({
	logPveFight: vi.fn().mockResolvedValue(undefined),
	collectors: [] as {
		reactionCollector: { data?: unknown };
		collectorOptions: { allowedPlayerKeycloakIds: string[]; time: number };
		endCallback: (collector: unknown, response: unknown[]) => Promise<void>;
		block: ReturnType<typeof vi.fn>;
	}[],
	fights: [] as {
		fighters: { fighter1: unknown; fighter2: unknown };
		options: { overtimeBehavior: unknown; context: unknown };
		endCallback?: (fight: unknown, response: unknown[]) => Promise<void>;
		startFight: ReturnType<typeof vi.fn>;
	}[],
	playerFighters: [] as {
		player: unknown;
		classData: unknown;
		loadStats: ReturnType<typeof vi.fn>;
		setBaseEnergy: ReturnType<typeof vi.fn>;
	}[]
}));

vi.mock("../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logPveFight: doubles.logPveFight } }
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({
	applyMaterialLoot: vi.fn().mockResolvedValue(undefined),
	generateBossLoot: vi.fn().mockReturnValue([]),
	updateCollectMaterialsMission: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../../src/core/report/ReportDestinationService", () => ({ chooseDestination: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../src/core/utils/withLockedPlayerSafe", () => ({ withLockedPlayerSafe: vi.fn() }));

vi.mock("../../../../Lib/src/locks/withLockedEntities", async importOriginal => ({
	...await importOriginal<typeof import("../../../../Lib/src/locks/withLockedEntities")>(),
	withLockedEntities: vi.fn()
}));

vi.mock("../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		readonly block = vi.fn().mockReturnThis();

		constructor(
			public reactionCollector: { data?: unknown },
			_context: unknown,
			public collectorOptions: { allowedPlayerKeycloakIds: string[]; time: number },
			public endCallback: (collector: unknown, response: unknown[]) => Promise<void>
		) {
			doubles.collectors.push(this);
		}

		build(): { collector: true } {
			return { collector: true };
		}
	}
}));

vi.mock("../../../src/core/fights/FightController", () => ({
	FightController: class {
		endCallback?: (fight: unknown, response: unknown[]) => Promise<void>;

		readonly startFight = vi.fn().mockResolvedValue(undefined);

		constructor(public fighters: { fighter1: unknown; fighter2: unknown }, public options: { overtimeBehavior: unknown; context: unknown }) {
			doubles.fights.push(this);
		}

		setEndCallback(callback: (fight: unknown, response: unknown[]) => Promise<void>): void {
			this.endCallback = callback;
		}
	}
}));

vi.mock("../../../src/core/fights/fighter/PlayerFighter", () => ({
	PlayerFighter: class {
		pet: unknown = null;

		readonly loadStats = vi.fn().mockResolvedValue(undefined);

		readonly setBaseEnergy = vi.fn();

		constructor(public player: unknown, public classData: unknown) {
			doubles.playerFighters.push(this);
		}

		getMaxEnergy(): number {
			return 100;
		}
	}
}));

import {
	doPVEBoss, getPveMonsterLevel, persistPveBossPostFightUnderLock
} from "../../../src/core/report/ReportPveService";
import { Player } from "../../../src/core/database/game/models/Player";
import { Guild } from "../../../src/core/database/game/models/Guild";
import { PlayerFighter } from "../../../src/core/fights/fighter/PlayerFighter";
import {
	Monster, MonsterDataController
} from "../../../src/data/Monster";
import { ClassDataController } from "../../../src/data/Class";
import { Maps } from "../../../src/core/maps/Maps";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../../src/core/database/game/models/PlayerActiveObjects";
import { LogsPveFightProgressionRequests } from "../../../src/core/database/logs/requests/LogsPveFightProgressionRequests";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import {
	applyMaterialLoot, generateBossLoot, updateCollectMaterialsMission
} from "../../../src/core/utils/MaterialLootUtils";
import { chooseDestination } from "../../../src/core/report/ReportDestinationService";
import { withLockedPlayerSafe } from "../../../src/core/utils/withLockedPlayerSafe";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { BlockingUtils } from "../../../src/core/utils/BlockingUtils";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import { RecipeDiscoveryService } from "../../../src/core/cooking/RecipeDiscoveryService";
import { CookingRecipeDataController } from "../../../src/data/CookingRecipeData";
import { MonsterFighter } from "../../../src/core/fights/fighter/MonsterFighter";
import { FightOvertimeBehavior } from "../../../src/core/fights/FightOvertimeBehavior";
import {
	getLowLevelPveMonsterLevel, getPveBossRole
} from "../../../src/core/report/PveMonsterLevel";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	CommandReportErrorNoMonsterRes, CommandReportMonsterRewardRes, CommandReportRefusePveFightRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	ReactionCollectorAcceptReaction, ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";

const MAP_ID = 42;
const START_TRAVEL = new Date("2026-03-01T10:00:00Z");
const context = { keycloakId: "pve-player" } as PacketContext;
const activeObjects = {} as PlayerActiveObjects;
const REWARDS = {
	money: 120, xp: 340, guildScore: 56, guildXp: 78
};

interface PveRow {
	id: number;
	keycloakId: string;
	level: number;
	class: number;
	guildId: number | null;
	fightPointsLost: number;
	startTravelDate: Date;
	getDestination: () => { id: number };
	addMoney: ReturnType<typeof vi.fn>;
	addExperience: ReturnType<typeof vi.fn>;
	leavePVEIslandIfNoEnergy: ReturnType<typeof vi.fn>;
	setLastReportWithEffect: ReturnType<typeof vi.fn>;
	setEnergyLost: ReturnType<typeof vi.fn>;
	getMaxCumulativeEnergy: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
}

function pveRow(overrides: Partial<PveRow> = {}): PveRow {
	return {
		id: 5,
		keycloakId: "pve-player",
		level: 150,
		class: 2,
		guildId: null,
		fightPointsLost: 0,
		startTravelDate: START_TRAVEL,
		getDestination: () => ({ id: MAP_ID }),
		addMoney: vi.fn().mockResolvedValue(undefined),
		addExperience: vi.fn().mockResolvedValue(undefined),
		leavePVEIslandIfNoEnergy: vi.fn().mockResolvedValue(false),
		setLastReportWithEffect: vi.fn().mockResolvedValue(undefined),
		setEnergyLost: vi.fn(),
		getMaxCumulativeEnergy: vi.fn().mockReturnValue(250),
		save: vi.fn().mockResolvedValue(undefined),
		...overrides
	};
}

function asPlayer(row: PveRow): Player {
	return row as unknown as Player; // Only the fields read by the boss flow, the model needs a database
}

let row: PveRow;
let lockedRow: PveRow;
let monster: Monster;

/**
 * The player of the flow and its row read again under the lock. The post-fight save copies the locked row onto the
 * player, so both share their methods to keep the calls observable.
 */
function setRows(overrides: Partial<PveRow> = {}): void {
	row = pveRow(overrides);
	lockedRow = {
		...pveRow(overrides),
		addMoney: row.addMoney,
		addExperience: row.addExperience,
		leavePVEIslandIfNoEnergy: row.leavePVEIslandIfNoEnergy,
		setLastReportWithEffect: row.setLastReportWithEffect
	};
}

function firstMonster(): Monster {
	const candidate = MonsterDataController.instance.getRandomMonster(-1, 0);
	if (!candidate) {
		throw new Error("No monster in the game data");
	}
	return candidate;
}

async function startBoss(): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await doPVEBoss(asPlayer(row), response, context);
	return response;
}

function monsterLevelOf(): number {
	const data = doubles.collectors[doubles.collectors.length - 1].reactionCollector.data as { monster: { level: number } };
	return data.monster.level;
}

beforeEach(() => {
	doubles.collectors.length = 0;
	doubles.fights.length = 0;
	doubles.playerFighters.length = 0;
	setRows();
	monster = firstMonster();
	vi.spyOn(MonsterDataController.instance, "getRandomMonster").mockReturnValue(monster);
	vi.spyOn(Maps, "isAtFinalPveBoss").mockReturnValue(false);
	vi.spyOn(Maps, "getPveIslandDepth").mockReturnValue(1);
	vi.spyOn(Maps, "stopTravel").mockResolvedValue(undefined);
	vi.spyOn(InventorySlots, "getPlayerActiveObjects").mockResolvedValue(activeObjects);
	vi.spyOn(LogsPveFightProgressionRequests, "getMonsterLevelBase").mockResolvedValue(null);
	vi.spyOn(LogsPveFightProgressionRequests, "getBossLadder").mockResolvedValue({
		strongestVictoryLevel: null, lastFight: null
	});
	vi.spyOn(BlockingUtils, "unblockPlayer").mockReturnValue(undefined);
	vi.mocked(withLockedPlayerSafe).mockImplementation((_player, _label, body) => body(asPlayer(lockedRow)));
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.mocked(MissionsController.update).mockClear();
	vi.mocked(applyMaterialLoot).mockClear();
	vi.mocked(generateBossLoot).mockReset().mockReturnValue([]);
	vi.mocked(updateCollectMaterialsMission).mockClear();
	vi.mocked(chooseDestination).mockClear();
	vi.mocked(withLockedEntities).mockReset();
	vi.mocked(withLockedPlayerSafe).mockClear();
	doubles.logPveFight.mockClear();
});

describe("doPVEBoss without monster", () => {
	it("should tell there is no monster and resume the travel", async () => {
		vi.mocked(MonsterDataController.instance.getRandomMonster).mockReturnValue(undefined);

		const response = await startBoss();

		expect(response[0]).toBeInstanceOf(CommandReportErrorNoMonsterRes);
		expect(row.leavePVEIslandIfNoEnergy).toHaveBeenCalledWith(response, activeObjects);
		expect(Maps.stopTravel).toHaveBeenCalledWith(row);
		expect(row.setLastReportWithEffect).toHaveBeenCalledWith(0, Effect.NO_EFFECT, NumberChangeReason.BIG_EVENT);
		expect(chooseDestination).toHaveBeenCalledWith(context, row, null, response);
		expect(doubles.collectors).toHaveLength(0);
	});

	it("should not choose a destination when the player leaves the island for lack of energy", async () => {
		vi.mocked(MonsterDataController.instance.getRandomMonster).mockReturnValue(undefined);
		row.leavePVEIslandIfNoEnergy.mockResolvedValue(true);

		await startBoss();

		expect(Maps.stopTravel).not.toHaveBeenCalled();
		expect(chooseDestination).not.toHaveBeenCalled();
	});
});

describe("doPVEBoss boss draw", () => {
	const seedOf = async (overrides: Partial<PveRow>): Promise<number> => {
		setRows(overrides);
		await startBoss();
		const calls = vi.mocked(MonsterDataController.instance.getRandomMonster).mock.calls;
		const [mapId, seed] = calls[calls.length - 1];
		expect(mapId).toBe(MAP_ID);
		return seed ?? Number.NaN;
	};

	it("should draw the boss from the destination and a seed set by the player and its travel start, in seconds", async () => {
		const seed = await seedOf({});

		expect(await seedOf({})).toBe(seed);
		expect(await seedOf({ startTravelDate: new Date(START_TRAVEL.valueOf() + 10_000) })).toBe(seed + 10);
		expect(await seedOf({ keycloakId: "another-player" })).not.toBe(seed);
		expect(seed).toBeGreaterThan(0);
	});

	it("should offer the fight to the player only, with the monster stats, blocking it meanwhile", async () => {
		const response = await startBoss();

		expect(response).toEqual([{ collector: true }]);
		const [collector] = doubles.collectors;
		expect(collector.collectorOptions).toEqual({
			allowedPlayerKeycloakIds: [row.keycloakId], time: PVEConstants.COLLECTOR_TIME
		});
		expect(collector.block).toHaveBeenCalledWith(row.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT);
		const level = monsterLevelOf();
		const monsterFighter = new MonsterFighter(level, monster);
		expect(collector.reactionCollector.data).toEqual({
			monster: {
				id: monster.id,
				level,
				attack: monsterFighter.getAttack(),
				defense: monsterFighter.getDefense(),
				speed: monsterFighter.getSpeed(),
				energy: monsterFighter.getEnergy()
			},
			mapId: MAP_ID
		});
	});

	it("should draw a high level boss around the record of the class lineage, or the player level without record", async () => {
		vi.mocked(LogsPveFightProgressionRequests.getMonsterLevelBase).mockResolvedValueOnce(200).mockResolvedValueOnce(300);
		await startBoss();
		const levelFrom200 = monsterLevelOf();
		await startBoss();
		const levelFrom300 = monsterLevelOf();
		await startBoss();
		const levelWithoutRecord = monsterLevelOf();

		expect(LogsPveFightProgressionRequests.getMonsterLevelBase).toHaveBeenCalledWith({
			playerKeycloakId: row.keycloakId, monsterId: monster.id, classId: row.class
		});
		expect(levelFrom300 - levelFrom200).toBe(100);
		expect(levelFrom200 - levelWithoutRecord).toBe(200 - row.level);
		expect(LogsPveFightProgressionRequests.getBossLadder).not.toHaveBeenCalled();
	});

	it("should draw a final boss with the final boss range", async () => {
		vi.mocked(LogsPveFightProgressionRequests.getMonsterLevelBase).mockResolvedValue(200);
		await startBoss();
		const seed = vi.mocked(MonsterDataController.instance.getRandomMonster).mock.calls[0][1] ?? 0;
		const regularLevel = monsterLevelOf();
		vi.mocked(Maps.isAtFinalPveBoss).mockReturnValue(true);
		await startBoss();

		expect(regularLevel).toBe(getPveMonsterLevel(200, seed, false));
		expect(monsterLevelOf()).toBe(getPveMonsterLevel(200, seed, true));
	});

	it("should draw the boss of a low level player from its ladder against this boss", async () => {
		setRows({ level: PVEConstants.LOW_LEVEL_PLAYER_THRESHOLD - 1 });
		const ladder = {
			strongestVictoryLevel: 40, lastFight: null
		};
		vi.mocked(LogsPveFightProgressionRequests.getBossLadder).mockResolvedValue(ladder);
		vi.mocked(Maps.getPveIslandDepth).mockReturnValue(3);

		await startBoss();

		const seed = vi.mocked(MonsterDataController.instance.getRandomMonster).mock.calls[0][1] ?? 0;
		expect(Maps.getPveIslandDepth).toHaveBeenCalledWith(MAP_ID);
		expect(LogsPveFightProgressionRequests.getBossLadder).toHaveBeenCalledWith({
			playerKeycloakId: row.keycloakId, monsterId: monster.id
		});
		expect(LogsPveFightProgressionRequests.getMonsterLevelBase).not.toHaveBeenCalled();
		expect(monsterLevelOf()).toBe(getLowLevelPveMonsterLevel({
			ladder,
			playerLevel: row.level,
			seed,
			role: getPveBossRole({
				depth: 3, isFinal: false
			})
		}));
	});
});

describe("doPVEBoss fight acceptance", () => {
	const answer = async (reactionType: string | null): Promise<CrowniclesPacket[]> => {
		await startBoss();
		const response: CrowniclesPacket[] = [];
		await doubles.collectors[0].endCallback({
			getFirstReaction: () => (reactionType === null ? null : { reaction: { type: reactionType } })
		}, response);
		return response;
	};

	it.each([null, ReactionCollectorRefuseReaction.name])("should refuse the fight on reaction %s and unblock the player", async reactionType => {
		const response = await answer(reactionType);

		expect(response).toEqual([expect.any(CommandReportRefusePveFightRes)]);
		expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(row.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT);
		expect(doubles.fights).toHaveLength(0);
	});

	it("should start the fight with the energy the player has left", async () => {
		row.fightPointsLost = 30;

		const response = await answer(ReactionCollectorAcceptReaction.name);

		const [playerFighter] = doubles.playerFighters;
		expect(playerFighter.player).toBe(row);
		expect(playerFighter.classData).toBe(ClassDataController.instance.getById(row.class));
		expect(playerFighter.loadStats).toHaveBeenCalledWith(true);
		expect(playerFighter.setBaseEnergy).toHaveBeenCalledWith(70);
		const [fight] = doubles.fights;
		expect(fight.fighters.fighter1).toBe(playerFighter);
		expect(fight.fighters.fighter2).toBeInstanceOf(MonsterFighter);
		expect(fight.options).toEqual({
			overtimeBehavior: FightOvertimeBehavior.INCREASE_DAMAGE_PVE, context
		});
		expect(fight.endCallback).toBeTypeOf("function");
		expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(row.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT);
		expect(fight.startFight).toHaveBeenCalledWith(response);
	});
});

describe("doPVEBoss fight outcome", () => {
	interface FakeFight {
		fightInitiator: { getMaxEnergy: () => number; getEnergy: () => number };
		isADraw: () => boolean;
		getWinnerFighter: () => unknown;
		getPostFightPetLoveChange: ReturnType<typeof vi.fn>;
		petReactionData?: unknown;
	}

	const winner = (pet: unknown = null): PlayerFighter => Object.assign(Object.create(PlayerFighter.prototype) as PlayerFighter, {
		pet, player: row
	});

	const fightWith = (outcome: { draw?: boolean; winner?: unknown; petLove?: unknown }): FakeFight => ({
		fightInitiator: {
			getMaxEnergy: () => 100, getEnergy: () => 64
		},
		isADraw: () => outcome.draw ?? false,
		getWinnerFighter: () => outcome.winner,
		getPostFightPetLoveChange: vi.fn().mockReturnValue(outcome.petLove ?? null)
	});

	const endFight = async (fight: FakeFight | null): Promise<CrowniclesPacket[]> => {
		await startBoss();
		await doubles.collectors[0].endCallback({ getFirstReaction: () => ({ reaction: { type: ReactionCollectorAcceptReaction.name } }) }, []);
		const response: CrowniclesPacket[] = [];
		await doubles.fights[0].endCallback?.(fight, response);
		return response;
	};

	let getRewards: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		getRewards = vi.spyOn(monster, "getRewards").mockReturnValue(REWARDS);
		vi.spyOn(BlessingManager, "getInstance").mockReturnValue({ applyMoneyBlessing: (amount: number) => amount * 2 } as BlessingManager);
	});

	const rewardPacket = (response: CrowniclesPacket[]): CommandReportMonsterRewardRes => {
		const packet = response.find(candidate => candidate instanceof CommandReportMonsterRewardRes);
		expect(packet).toBeDefined();
		return packet as CommandReportMonsterRewardRes;
	};

	it("should reward a victory with the rewards of the boss level and resume the travel", async () => {
		const discover = vi.spyOn(RecipeDiscoveryService, "discoverFromBoss");
		const response = await endFight(fightWith({ winner: winner() }));

		expect(getRewards).toHaveBeenCalledWith(monsterLevelOf());
		expect(row.addMoney).toHaveBeenCalledWith({
			amount: REWARDS.money, reason: NumberChangeReason.PVE_FIGHT, response
		});
		expect(row.addExperience).toHaveBeenCalledWith({
			amount: REWARDS.xp, reason: NumberChangeReason.PVE_FIGHT, response
		});
		expect(rewardPacket(response)).toMatchObject({
			money: REWARDS.money * 2,
			experience: REWARDS.xp,
			guildXp: 0,
			guildPoints: 0,
			petReaction: undefined
		});
		expect(rewardPacket(response).materialLoot).toBeUndefined();
		expect(rewardPacket(response).discoveredRecipe).toBeUndefined();
		expect(MissionsController.update).toHaveBeenCalledWith(row, response, { missionId: "winBoss" });
		expect(MissionsController.update).toHaveBeenCalledWith(row, response, {
			missionId: "winAnyBossWithDifferentClasses", params: { classId: row.class }
		});
		expect(MissionsController.update).toHaveBeenCalledTimes(2);
		expect(discover).not.toHaveBeenCalled();
		expect(applyMaterialLoot).not.toHaveBeenCalled();
		expect(updateCollectMaterialsMission).not.toHaveBeenCalled();
		expect(lockedRow.fightPointsLost).toBe(36);
		expect(lockedRow.setEnergyLost).not.toHaveBeenCalled();
		expect(lockedRow.save).toHaveBeenCalledOnce();
		expect(doubles.logPveFight).toHaveBeenCalledWith(expect.anything(), row.level);
		expect(chooseDestination).toHaveBeenCalledWith(context, row, null, response);
	});

	it("should reward a draw like a victory, without pet reaction", async () => {
		const fight = fightWith({
			draw: true, petLove: { loveChange: 3, reactionType: "happy" }
		});

		const response = await endFight(fight);

		expect(row.addMoney).toHaveBeenCalled();
		expect(fight.getPostFightPetLoveChange).not.toHaveBeenCalled();
		expect(rewardPacket(response).petReaction).toBeUndefined();
	});

	it("should drain the energy left after a defeat and give nothing", async () => {
		const response = await endFight(fightWith({ winner: {} }));

		expect(row.addMoney).not.toHaveBeenCalled();
		expect(response.some(packet => packet instanceof CommandReportMonsterRewardRes)).toBe(false);
		expect(lockedRow.setEnergyLost).toHaveBeenCalledWith(250, NumberChangeReason.PVE_FIGHT, activeObjects);
		expect(lockedRow.getMaxCumulativeEnergy).toHaveBeenCalledWith(activeObjects);
		expect(lockedRow.fightPointsLost).toBe(0);
		expect(lockedRow.save).toHaveBeenCalledOnce();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("should only resume the travel when the fight could not take place", async () => {
		await endFight(null);

		expect(getRewards).not.toHaveBeenCalled();
		expect(withLockedPlayerSafe).not.toHaveBeenCalled();
		expect(doubles.logPveFight).not.toHaveBeenCalled();
		expect(chooseDestination).toHaveBeenCalledOnce();
	});

	it("should give the boss material loot and count it for the missions", async () => {
		const loot = [{
			materialId: 12, quantity: 2
		}];
		vi.mocked(generateBossLoot).mockReturnValue(loot);

		const response = await endFight(fightWith({ winner: winner() }));

		expect(generateBossLoot).toHaveBeenCalledWith(monster);
		expect(applyMaterialLoot).toHaveBeenCalledWith(row.id, loot);
		expect(updateCollectMaterialsMission).toHaveBeenCalledWith(row, response, loot);
		expect(rewardPacket(response).materialLoot).toEqual(loot);
	});

	it("should grant a recipe and count the different classes mission for a final boss only", async () => {
		const recipe = CookingRecipeDataController.instance.getById("potion_health_7");
		if (!recipe) {
			throw new Error("Missing boss recipe");
		}
		vi.mocked(Maps.isAtFinalPveBoss).mockReturnValue(true);
		const discover = vi.spyOn(RecipeDiscoveryService, "discoverFromBoss").mockResolvedValue(recipe);

		const response = await endFight(fightWith({ winner: winner() }));

		expect(discover).toHaveBeenCalledWith(row, MAP_ID);
		expect(rewardPacket(response).discoveredRecipe).toEqual(RecipeDiscoveryService.toDisplayInfo(recipe));
		expect(MissionsController.update).toHaveBeenCalledWith(row, response, {
			missionId: "winBossWithDifferentClasses", params: { classId: row.class }
		});
	});

	it("should announce no recipe when the final boss already granted one", async () => {
		vi.mocked(Maps.isAtFinalPveBoss).mockReturnValue(true);
		vi.spyOn(RecipeDiscoveryService, "discoverFromBoss").mockResolvedValue(null);

		const response = await endFight(fightWith({ winner: winner() }));

		expect(rewardPacket(response).discoveredRecipe).toBeUndefined();
	});

	it("should make the pet of the winner love it more and show its reaction", async () => {
		const pet = {
			typeId: 7,
			sex: "f",
			nickname: "Rex",
			changeLovePoints: vi.fn().mockResolvedValue(undefined),
			save: vi.fn().mockResolvedValue(undefined)
		};
		const petLove = {
			loveChange: 4, reactionType: "proud"
		};
		const fight = fightWith({
			winner: winner(pet), petLove
		});

		const response = await endFight(fight);

		expect(pet.changeLovePoints).toHaveBeenCalledWith({
			player: row, response, amount: 4, reason: NumberChangeReason.FIGHT
		});
		expect(pet.save).toHaveBeenCalledWith({ fields: ["lovePoints"] });
		expect(fight.petReactionData).toEqual({
			keycloakId: row.keycloakId, reactionType: "proud", loveDelta: 4, petId: 7, petSex: "f", petNickname: "Rex"
		});
		expect(rewardPacket(response).petReaction).toEqual({
			reactionType: "proud", loveDelta: 4, petId: 7, petSex: "f", petNickname: "Rex"
		});
	});

	it("should leave the pet alone without love change or without pet", async () => {
		const pet = {
			changeLovePoints: vi.fn(), save: vi.fn()
		};

		await endFight(fightWith({
			winner: winner(pet)
		}));
		await endFight(fightWith({
			winner: winner(null), petLove: { loveChange: 4, reactionType: "proud" }
		}));

		expect(pet.changeLovePoints).not.toHaveBeenCalled();
	});

	describe("guild rewards", () => {
		const guild = (level: number): {
			level: number; addScore: ReturnType<typeof vi.fn>; addExperience: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>;
		} => ({
			level,
			addScore: vi.fn().mockResolvedValue(undefined),
			addExperience: vi.fn().mockResolvedValue(undefined),
			save: vi.fn().mockResolvedValue(undefined)
		});

		beforeEach(() => {
			setRows({ guildId: 3 });
		});

		it("should give the guild its score and experience under the guild lock", async () => {
			const lockedGuild = guild(1);
			vi.mocked(withLockedEntities).mockImplementation((keys, body) => body([lockedGuild] as never));

			const response = await endFight(fightWith({ winner: winner() }));

			expect(withLockedEntities).toHaveBeenCalledWith([Guild.lockKey(3)], expect.any(Function));
			expect(lockedGuild.addScore).toHaveBeenCalledWith({
				amount: REWARDS.guildScore, response, reason: NumberChangeReason.PVE_FIGHT
			});
			expect(lockedGuild.addExperience).toHaveBeenCalledWith({
				amount: REWARDS.guildXp, response, reason: NumberChangeReason.PVE_FIGHT
			});
			expect(lockedGuild.save).toHaveBeenCalledOnce();
			expect(rewardPacket(response)).toMatchObject({
				guildXp: REWARDS.guildXp, guildPoints: REWARDS.guildScore
			});
		});

		it("should not announce guild experience to a guild at the maximum level", async () => {
			vi.mocked(withLockedEntities).mockImplementation((keys, body) => body([guild(GuildConstants.MAX_LEVEL)] as never));

			const response = await endFight(fightWith({ winner: winner() }));

			expect(rewardPacket(response)).toMatchObject({
				guildXp: 0, guildPoints: REWARDS.guildScore
			});
		});

		it("should still reward the player when the guild disappeared meanwhile", async () => {
			vi.mocked(withLockedEntities).mockRejectedValue(new LockedRowNotFoundError(Guild.lockKey(3)));

			const response = await endFight(fightWith({ winner: winner() }));

			expect(rewardPacket(response)).toMatchObject({
				guildXp: 0, guildPoints: 0
			});
		});

		it("should not swallow an unexpected guild error", async () => {
			vi.mocked(withLockedEntities).mockRejectedValue(new Error("database down"));

			await expect(endFight(fightWith({ winner: winner() }))).rejects.toThrow("database down");
		});
	});
});

describe("persistPveBossPostFightUnderLock", () => {
	it("should resync the local player with the persisted row", async () => {
		lockedRow.fightPointsLost = 12;

		await persistPveBossPostFightUnderLock(asPlayer(row) as never, 20, true, activeObjects);

		expect(withLockedPlayerSafe).toHaveBeenCalledWith(row, "doPVEBoss post-fight save", expect.any(Function));
		expect(row.fightPointsLost).toBe(20);
		expect(lockedRow.save).toHaveBeenCalledOnce();
	});
});
