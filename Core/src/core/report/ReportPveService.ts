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
import { MonsterDataController } from "../../data/Monster";
import { ClassDataController } from "../../data/Class";
import { MissionsController } from "../missions/MissionsController";
import { Guilds } from "../database/game/models/Guild";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
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
import { InventorySlots } from "../database/game/models/InventorySlot";
import { chooseDestination } from "./ReportDestinationService";

/**
 * Handle rewards and pet reactions after a PVE fight
 * @param fight
 * @param player
 * @param rewards
 * @param endFightResponse
 */
async function handlePveFightRewards(
	fight: FightController,
	player: Player,
	rewards: {
		money: number; xp: number; guildScore: number; guildXp: number;
	},
	endFightResponse: CrowniclesPacket[]
): Promise<{
	guildXp: number; guildPoints: number;
}> {
	let guildXp = 0;
	let guildPoints = 0;

	if (!fight.isADraw()) {
		const winner = fight.getWinnerFighter();
		const petLoveResult = fight.getPostFightPetLoveChange(winner, PostFightPetLoveOutcomes.WIN);
		if (petLoveResult && winner instanceof RealPlayerFighter) {
			const petEntity = winner.pet;
			if (petEntity) {
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
	}, await InventorySlots.getPlayerActiveObjects(player.id));

	if (player.guildId) {
		const guild = await Guilds.getById(player.guildId);
		if (guild) {
			await guild.addScore({
				amount: rewards.guildScore, response: endFightResponse, reason: NumberChangeReason.PVE_FIGHT
			});
			await guild.addExperience({
				amount: rewards.guildXp, response: endFightResponse, reason: NumberChangeReason.PVE_FIGHT
			});
			await guild.save();
			if (guild.level < GuildConstants.MAX_LEVEL) {
				guildXp = rewards.guildXp;
			}
			guildPoints = rewards.guildScore;
		}
	}
	return {
		guildXp, guildPoints
	};
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
	const seed = player.id + millisecondsToSeconds(player.startTravelDate.valueOf());
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
			let guildXp = 0;
			let guildPoints = 0;

			player.fightPointsLost = fight.fightInitiator.getMaxEnergy() - fight.fightInitiator.getEnergy();

			// Only give reward if draw or win
			if (fight.isADraw() || fight.getWinnerFighter() instanceof RealPlayerFighter) {
				const result = await handlePveFightRewards(fight, player, rewards, endFightResponse);
				guildXp = result.guildXp;
				guildPoints = result.guildPoints;
				endFightResponse.push(makePacket(CommandReportMonsterRewardRes, {
					money: rewards.money,
					experience: rewards.xp,
					guildXp,
					guildPoints,
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
				await MissionsController.update(player, endFightResponse, { missionId: "winBoss" });

				// Only count final island bosses for the different classes mission
				if (Maps.isAtPveExit(player)) {
					await MissionsController.update(player, endFightResponse, {
						missionId: "winBossWithDifferentClasses",
						params: { classId: player.class }
					});
				}
			}
			else {
				// Make sure the player has no energy left after a loss even if he leveled up
				player.setEnergyLost(player.getMaxCumulativeEnergy(playerActiveObjects), NumberChangeReason.PVE_FIGHT, playerActiveObjects);
			}

			await player.save();

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
