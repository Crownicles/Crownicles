import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportErrorNoMonsterRes,
	CommandReportMonsterRewardRes,
	CommandReportRefusePveFightRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { Player } from "../database/game/models/Player";
import { FightController } from "../fights/FightController";
import { FightOvertimeBehavior } from "../fights/FightOvertimeBehavior";
import { RealPlayerFighter } from "../fights/fighter/RealPlayerFighter";
import { MonsterFighter } from "../fights/fighter/MonsterFighter";
import {
	Monster, MonsterDataController
} from "../../data/Monster";
import { ClassDataController } from "../../data/Class";
import { MissionsController } from "../missions/MissionsController";
import {
	Guild
} from "../database/game/models/Guild";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { PostFightPetLoveOutcomes } from "../../../../Lib/src/constants/PetConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import { BlessingManager } from "../blessings/BlessingManager";
import { withLockedPlayerSafe } from "../utils/withLockedPlayerSafe";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { ReactionCollectorPveFight } from "../../../../Lib/src/packets/interaction/ReactionCollectorPveFight";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { Maps } from "../maps/Maps";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	dateToMs, millisecondsToSeconds
} from "../../../../Lib/src/utils/TimeUtils";
import { crowniclesInstance } from "../../index";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";
import { chooseDestination } from "./ReportDestinationService";
import { RecipeDiscoveryService } from "../cooking/RecipeDiscoveryService";
import {
	applyMaterialLoot, generateBossLoot
} from "../utils/MaterialLootUtils";
import { MaterialQuantity } from "../../../../Lib/src/types/MaterialQuantity";

/**
 * PVE fight rewards structure
 */
interface PveFightRewards {
	money: number;
	xp: number;
	guildScore: number;
	guildXp: number;
}

/**
 * Guild rewards result
 */
interface GuildRewardsResult {
	guildXp: number;
	guildPoints: number;
}

/**
 * Handle pet love points change for the winner of a PVE fight
 */
async function handleWinnerPetLovePoints(
	fight: FightController,
	endFightResponse: CrowniclesPacket[]
): Promise<void> {
	if (fight.isADraw()) {
		return;
	}

	const winner = fight.getWinnerFighter();
	const petLoveResult = fight.getPostFightPetLoveChange(winner, PostFightPetLoveOutcomes.WIN);
	if (!petLoveResult || !(winner instanceof RealPlayerFighter)) {
		return;
	}

	const petEntity = winner.pet;
	if (!petEntity) {
		return;
	}

	await petEntity.changeLovePoints({
		player: winner.player,
		response: endFightResponse,
		amount: petLoveResult.loveChange,
		reason: NumberChangeReason.FIGHT
	});
	await petEntity.save({ fields: ["lovePoints"] });
	fight.petReactionData = {
		keycloakId: winner.player.keycloakId,
		reactionType: petLoveResult.reactionType,
		loveDelta: petLoveResult.loveChange,
		petId: petEntity.typeId,
		petSex: petEntity.sex,
		petNickname: petEntity.nickname
	};
}

/**
 * Handle guild rewards (score + XP) after a PVE fight. The
 * read+mutate+save sequence is wrapped in a Guild row lock so
 * two concurrent PVE rewards from different guild members
 * cannot lose each other's score / XP increments.
 */
async function applyGuildRewards(
	player: Player,
	rewards: PveFightRewards,
	endFightResponse: CrowniclesPacket[]
): Promise<GuildRewardsResult> {
	if (!player.guildId) {
		return {
			guildXp: 0, guildPoints: 0
		};
	}

	const guildId = player.guildId;
	try {
		return await withLockedEntities(
			[Guild.lockKey(guildId)] as const,
			async ([guild]) => {
				await guild.addScore({
					amount: rewards.guildScore, response: endFightResponse, reason: NumberChangeReason.PVE_FIGHT
				});
				await guild.addExperience({
					amount: rewards.guildXp, response: endFightResponse, reason: NumberChangeReason.PVE_FIGHT
				});
				await guild.save();

				return {
					guildXp: guild.level < GuildConstants.MAX_LEVEL ? rewards.guildXp : 0,
					guildPoints: rewards.guildScore
				};
			}
		);
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			/*
			 * The guild was destroyed between the fight and the
			 * reward. Surface a no-guild result so the client
			 * still gets a coherent recap packet.
			 */
			return {
				guildXp: 0, guildPoints: 0
			};
		}
		throw error;
	}
}

/**
 * Handle rewards and pet reactions after a PVE fight
 */
async function handlePveFightRewards(
	fight: FightController,
	player: Player,
	rewards: PveFightRewards,
	endFightResponse: CrowniclesPacket[],
	playerActiveObjects: PlayerActiveObjects
): Promise<GuildRewardsResult> {
	await handleWinnerPetLovePoints(fight, endFightResponse);

	await player.addMoney({
		amount: rewards.money,
		reason: NumberChangeReason.PVE_FIGHT,
		response: endFightResponse
	});
	await player.addExperience({
		amount: rewards.xp,
		reason: NumberChangeReason.PVE_FIGHT,
		response: endFightResponse
	}, playerActiveObjects);

	return await applyGuildRewards(player, rewards, endFightResponse);
}

/**
 * Send monster reward packet
 */
function sendMonsterRewardPacket(
	endFightResponse: CrowniclesPacket[],
	rewards: PveFightRewards,
	guildResult: GuildRewardsResult,
	fight: FightController,
	materialLoot?: MaterialQuantity[]
): void {
	endFightResponse.push(makePacket(CommandReportMonsterRewardRes, {
		money: BlessingManager.getInstance().applyMoneyBlessing(rewards.money),
		experience: rewards.xp,
		guildXp: guildResult.guildXp,
		guildPoints: guildResult.guildPoints,
		petReaction: fight.petReactionData
			? {
				reactionType: fight.petReactionData.reactionType,
				loveDelta: fight.petReactionData.loveDelta,
				petId: fight.petReactionData.petId,
				petSex: fight.petReactionData.petSex,
				petNickname: fight.petReactionData.petNickname
			}
			: undefined,
		...materialLoot && materialLoot.length > 0 ? { materialLoot } : {}
	}));
}

/**
 * Apply the win/draw branch of a PvE boss fight: rewards, material loot, and
 * the related missions / recipe-discovery side effects. Extracted from
 * `doPVEBoss.fightCallback` to keep the callback's cyclomatic complexity low.
 */
const PVE_BOSS_MISSION_IDS = {
	WIN_BOSS: "winBoss",
	WIN_ANY_BOSS_WITH_DIFFERENT_CLASSES: "winAnyBossWithDifferentClasses",
	WIN_BOSS_WITH_DIFFERENT_CLASSES: "winBossWithDifferentClasses"
} as const;
type PveBossMissionId = typeof PVE_BOSS_MISSION_IDS[keyof typeof PVE_BOSS_MISSION_IDS];

type ApplyPveBossWinRewardsCtx = {
	fight: FightController;
	player: Player;
	rewards: ReturnType<Monster["getRewards"]>;
	endFightResponse: CrowniclesPacket[];
	playerActiveObjects: PlayerActiveObjects;
	mapId: number;
};

async function applyPveBossWinRewards(ctx: ApplyPveBossWinRewardsCtx): Promise<void> {
	const {
		fight, player, rewards, endFightResponse, playerActiveObjects, mapId
	} = ctx;
	const result = await handlePveFightRewards(fight, player, rewards, endFightResponse, playerActiveObjects);

	// Generate and apply material loot from boss
	const materialLoot = generateBossLoot(mapId);
	if (materialLoot.length > 0) {
		await applyMaterialLoot(player.id, materialLoot);
	}

	sendMonsterRewardPacket(endFightResponse, rewards, result, fight, materialLoot);
	await MissionsController.update(player, endFightResponse, {
		missionId: PVE_BOSS_MISSION_IDS.WIN_BOSS satisfies PveBossMissionId
	});
	await MissionsController.update(player, endFightResponse, {
		missionId: PVE_BOSS_MISSION_IDS.WIN_ANY_BOSS_WITH_DIFFERENT_CLASSES satisfies PveBossMissionId,
		params: { classId: player.class }
	});

	// Only count final island bosses for the different classes mission
	if (Maps.isAtFinalPveBoss(player)) {
		await MissionsController.update(player, endFightResponse, {
			missionId: PVE_BOSS_MISSION_IDS.WIN_BOSS_WITH_DIFFERENT_CLASSES satisfies PveBossMissionId,
			params: { classId: player.class }
		});

		// Discover an island boss cooking recipe
		await RecipeDiscoveryService.discoverFromBoss(player, mapId);
	}
}

/**
 * Persist the post-fight scalar state under a row-level lock. The inner
 * addMoney / addExperience / MissionsController.update chains in
 * `applyPveBossWinRewards` already committed money / XP / score / missions on
 * freshly-locked rows (PR-H1). The only mutation that survived all those
 * Object.assign(this, newPlayer) calls and still needs to be persisted here
 * is the fight-points-lost / energy-lost scalar — which we re-derive against
 * the freshly-locked instance to avoid lost-update on concurrent writers and
 * to dodge the latent clobber-by-Object.assign on the local `player`.
 */
async function persistPveBossPostFightUnderLock(
	player: Player,
	initialFightPointsLost: number,
	isWinOrDraw: boolean,
	playerActiveObjects: PlayerActiveObjects
): Promise<void> {
	await withLockedPlayerSafe(player, "doPVEBoss post-fight save", async lockedPlayer => {
		if (isWinOrDraw) {
			lockedPlayer.fightPointsLost = initialFightPointsLost;
		}
		else {
			// Make sure the player has no energy left after a loss even if they levelled up
			lockedPlayer.setEnergyLost(
				lockedPlayer.getMaxCumulativeEnergy(playerActiveObjects),
				NumberChangeReason.PVE_FIGHT,
				playerActiveObjects
			);
		}
		await lockedPlayer.save();

		/*
		 * Reflect the persisted state on the local instance for downstream readers
		 * (`leavePVEIslandIfNoEnergy` below reads `player.fightPointsLost`).
		 */
		player.fightPointsLost = lockedPlayer.fightPointsLost;
	});
}

/**
 * Do a PVE boss fight
 * @param player
 * @param response
 * @param context
 */
export async function doPVEBoss(
	player: Player,
	response: CrowniclesPacket[],
	context: PacketContext
): Promise<void> {
	// Use a hash of keycloakId rather than the sequential player.id to prevent seed prediction
	const keycloakIdHash = Math.abs(Array.from(player.keycloakId).reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0) | 0, 0));
	const seed = keycloakIdHash + millisecondsToSeconds(dateToMs(player.startTravelDate));
	const mapId = player.getDestination()!.id;
	const monsterObj = MonsterDataController.instance.getRandomMonster(mapId, seed);
	const randomLevel = player.level - PVEConstants.MONSTER_LEVEL_RANDOM_RANGE / 2 + seed % PVEConstants.MONSTER_LEVEL_RANDOM_RANGE;

	/**
	 * Handle rewards after the PVE fight completes
	 */
	const fightCallback = async (fight: FightController | null, endFightResponse: CrowniclesPacket[]): Promise<void> => {
		const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
		if (fight) {
			const rewards = monsterObj.getRewards(randomLevel);

			const initialFightPointsLost = fight.fightInitiator.getMaxEnergy() - fight.fightInitiator.getEnergy();
			player.fightPointsLost = initialFightPointsLost;

			const isWinOrDraw = fight.isADraw() || fight.getWinnerFighter() instanceof RealPlayerFighter;

			if (isWinOrDraw) {
				await applyPveBossWinRewards({
					fight, player, rewards, endFightResponse, playerActiveObjects, mapId
				});
			}

			await persistPveBossPostFightUnderLock(player, initialFightPointsLost, isWinOrDraw, playerActiveObjects);

			crowniclesInstance?.logsDatabase.logPveFight(fight)
				.then();
		}

		if (!await player.leavePVEIslandIfNoEnergy(endFightResponse, playerActiveObjects)) {
			await Maps.stopTravel(player);
			await player.setLastReportWithEffect(
				0,
				Effect.NO_EFFECT,
				NumberChangeReason.BIG_EVENT
			);
			await chooseDestination(context, player, null, endFightResponse);
		}
	};

	if (!monsterObj) {
		response.push(makePacket(CommandReportErrorNoMonsterRes, {}));
		await fightCallback(null, response);
		return;
	}

	const monsterFighter = new MonsterFighter(
		randomLevel,
		monsterObj
	);

	const reactionCollector = new ReactionCollectorPveFight({
		monster: {
			id: monsterObj.id,
			level: randomLevel,
			attack: monsterFighter.getAttack(),
			defense: monsterFighter.getDefense(),
			speed: monsterFighter.getSpeed(),
			energy: monsterFighter.getEnergy()
		},
		mapId
	});

	/**
	 * Handle the end of the PVE fight collector
	 */
	const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => {
		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandReportRefusePveFightRes, {}));
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT);
			return;
		}

		const playerFighter = new RealPlayerFighter(player, ClassDataController.instance.getById(player.class)!);
		await playerFighter.loadStats();
		playerFighter.setBaseEnergy(playerFighter.getMaxEnergy() - player.fightPointsLost);

		const fight = new FightController(
			{
				fighter1: playerFighter,
				fighter2: monsterFighter
			},
			FightOvertimeBehavior.INCREASE_DAMAGE_PVE,
			context
		);
		fight.setEndCallback(fightCallback);
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT);
		await fight.startFight(response);
	};

	const packet = new ReactionCollectorInstance(
		reactionCollector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			time: PVEConstants.COLLECTOR_TIME
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT)
		.build();

	response.push(packet);
}
