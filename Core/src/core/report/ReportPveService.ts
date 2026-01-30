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
import { PlayerFighter } from "../fights/fighter/PlayerFighter";
import { MonsterFighter } from "../fights/fighter/MonsterFighter";
import { MonsterDataController } from "../../data/Monster";
import { ClassDataController } from "../../data/Class";
import { MissionsController } from "../missions/MissionsController";
import { Guilds } from "../database/game/models/Guild";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { PostFightPetLoveOutcomes } from "../../../../Lib/src/constants/PetConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { ReactionCollectorPveFight } from "../../../../Lib/src/packets/interaction/ReactionCollectorPveFight";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { Maps } from "../maps/Maps";
import { Effect } from "../../../../Lib/src/types/Effect";
import { millisecondsToSeconds } from "../../../../Lib/src/utils/TimeUtils";
import { crowniclesInstance } from "../../index";
import { MapLink } from "../../data/MapLink";

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
 * ChooseDestination callback type
 */
type ChooseDestinationCallback = (
	context: PacketContext,
	player: Player,
	forcedLink: MapLink | null,
	response: CrowniclesPacket[]
) => Promise<void>;

/**
 * Handle pet reactions and love changes after fight
 */
async function handlePetReaction(
	fight: FightController,
	winner: PlayerFighter,
	endFightResponse: CrowniclesPacket[]
): Promise<void> {
	const petLoveResult = fight.getPostFightPetLoveChange(winner, PostFightPetLoveOutcomes.WIN);
	if (!petLoveResult) {
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
 * Handle guild rewards after PVE fight
 */
async function applyGuildRewards(
	player: Player,
	rewards: PveFightRewards,
	endFightResponse: CrowniclesPacket[]
): Promise<GuildRewardsResult> {
	if (!player.guildId) {
		return {
			guildXp: 0,
			guildPoints: 0
		};
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return {
			guildXp: 0,
			guildPoints: 0
		};
	}
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

/**
 * Handle rewards and pet reactions after a PVE fight
 */
async function handlePveFightRewards(
	fight: FightController,
	player: Player,
	rewards: PveFightRewards,
	endFightResponse: CrowniclesPacket[]
): Promise<GuildRewardsResult> {
	if (!fight.isADraw()) {
		const winner = fight.getWinnerFighter();
		if (winner instanceof PlayerFighter) {
			await handlePetReaction(fight, winner, endFightResponse);
		}
	}

	await player.addMoney({
		amount: rewards.money,
		reason: NumberChangeReason.PVE_FIGHT,
		response: endFightResponse
	});
	await player.addExperience({
		amount: rewards.xp,
		reason: NumberChangeReason.PVE_FIGHT,
		response: endFightResponse
	});

	return await applyGuildRewards(player, rewards, endFightResponse);
}

/**
 * Send monster reward packet
 */
function sendMonsterRewardPacket(
	endFightResponse: CrowniclesPacket[],
	rewards: PveFightRewards,
	guildResult: GuildRewardsResult,
	fight: FightController
): void {
	endFightResponse.push(makePacket(CommandReportMonsterRewardRes, {
		money: rewards.money,
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
			: undefined
	}));
}

/**
 * Create the fight callback handler
 */
function createFightCallback(
	player: Player,
	monsterObj: ReturnType<typeof MonsterDataController.instance.getRandomMonster> | null,
	randomLevel: number,
	context: PacketContext,
	chooseDestinationFn: ChooseDestinationCallback
): (fight: FightController | null, endFightResponse: CrowniclesPacket[]) => Promise<void> {
	return async (fight: FightController | null, endFightResponse: CrowniclesPacket[]): Promise<void> => {
		if (fight && monsterObj) {
			const rewards = monsterObj.getRewards(randomLevel);
			player.fightPointsLost = fight.fightInitiator.getMaxEnergy() - fight.fightInitiator.getEnergy();

			// Only give reward if draw or win
			const isWinOrDraw = fight.isADraw() || fight.getWinnerFighter() instanceof PlayerFighter;

			if (isWinOrDraw) {
				const guildResult = await handlePveFightRewards(fight, player, rewards, endFightResponse);
				sendMonsterRewardPacket(endFightResponse, rewards, guildResult, fight);
				await MissionsController.update(player, endFightResponse, { missionId: "winBoss" });
			}
			else {
				// Make sure the player has no energy left after a loss even if he leveled up
				player.setEnergyLost(player.getMaxCumulativeEnergy(), NumberChangeReason.PVE_FIGHT);
			}

			await player.save();
			crowniclesInstance.logsDatabase.logPveFight(fight).then();
		}

		if (!await player.leavePVEIslandIfNoEnergy(endFightResponse)) {
			await Maps.stopTravel(player);
			await player.setLastReportWithEffect(0, Effect.NO_EFFECT, NumberChangeReason.BIG_EVENT);
			await chooseDestinationFn(context, player, null, endFightResponse);
		}
	};
}

/**
 * Create the collector end callback
 */
function createCollectorEndCallback(
	player: Player,
	_monsterObj: ReturnType<typeof MonsterDataController.instance.getRandomMonster>,
	monsterFighter: MonsterFighter,
	_randomLevel: number,
	context: PacketContext,
	fightCallback: (fight: FightController | null, endFightResponse: CrowniclesPacket[]) => Promise<void>
): EndCallback {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => {
		const firstReaction = collector.getFirstReaction();
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorRefuseReaction.name) {
			response.push(makePacket(CommandReportRefusePveFightRes, {}));
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.START_BOSS_FIGHT);
			return;
		}

		const playerClass = ClassDataController.instance.getById(player.class);
		if (!playerClass) {
			throw new Error("Player class not found");
		}
		const playerFighter = new PlayerFighter(player, playerClass);
		playerFighter.setFightRole(FightConstants.FIGHT_ROLES.ATTACKER);
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
}

/**
 * Do a PVE boss fight
 */
export async function doPVEBoss(
	player: Player,
	response: CrowniclesPacket[],
	context: PacketContext,
	chooseDestinationFn: ChooseDestinationCallback
): Promise<void> {
	const seed = player.id + millisecondsToSeconds(player.startTravelDate.valueOf());
	const mapId = player.getDestination()!.id;
	const monsterObj = MonsterDataController.instance.getRandomMonster(mapId, seed);
	const randomLevel = player.level - PVEConstants.MONSTER_LEVEL_RANDOM_RANGE / 2 + seed % PVEConstants.MONSTER_LEVEL_RANDOM_RANGE;

	if (!monsterObj) {
		response.push(makePacket(CommandReportErrorNoMonsterRes, {}));
		const fightCallback = createFightCallback(player, null, randomLevel, context, chooseDestinationFn);
		await fightCallback(null, response);
		return;
	}

	const monsterFighter = new MonsterFighter(randomLevel, monsterObj);
	const fightCallback = createFightCallback(player, monsterObj, randomLevel, context, chooseDestinationFn);

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

	const endCallback = createCollectorEndCallback(
		player,
		monsterObj,
		monsterFighter,
		randomLevel,
		context,
		fightCallback
	);

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
