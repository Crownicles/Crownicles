import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	PetEntities, PetEntity
} from "../../core/database/game/models/PetEntity";
import { PetExpeditions } from "../../core/database/game/models/PetExpedition";
import { PetDataController } from "../../data/Pet";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { Guilds } from "../../core/database/game/models/Guild";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	CommandPetExpeditionPacketReq,
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionResolvePacketReq,
	CommandPetExpeditionResolvePacketRes,
	CommandPetExpeditionErrorPacket,
	ExpeditionData,
	FoodConsumptionDetail
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	PendingExpeditionsCache,
	generateThreeExpeditions,
	calculateRewardIndex,
	calculateFoodConsumptionPlan,
	applyFoodConsumptionPlan,
	calculateEffectiveRisk,
	determineExpeditionOutcome,
	validateExpeditionPrerequisites,
	applyExpeditionRewards,
	FoodConsumptionPlan
} from "../../core/expeditions";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import {
	ReactionCollectorPetExpedition,
	ReactionCollectorPetExpeditionRecallReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpedition";
import {
	ReactionCollectorPetExpeditionChoice,
	ReactionCollectorPetExpeditionSelectReaction,
	ExpeditionOptionData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionChoice";
import {
	ReactionCollectorPetExpeditionFinished,
	ReactionCollectorPetExpeditionClaimReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionFinished";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { Maps } from "../../core/maps/Maps";

/**
 * Convert a FoodConsumptionPlan to an array of FoodConsumptionDetail for packet transmission
 */
function foodPlanToDetails(plan: FoodConsumptionPlan): FoodConsumptionDetail[] {
	return plan.consumption.map(item => ({
		foodType: item.foodType,
		amount: item.itemsToConsume
	}));
}

/**
 * Handle expedition choice selection
 */
async function handleExpeditionSelect(
	player: Player,
	petEntity: PetEntity,
	expeditionId: string,
	keycloakId: string,
	response: CrowniclesPacket[]
): Promise<void> {
	// Validate requirements
	if (!player.hasTalisman || !player.petId) {
		response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
			success: false,
			failureReason: "invalidState"
		}));
		return;
	}

	// Check no expedition in progress
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (activeExpedition) {
		response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
			success: false,
			failureReason: "expeditionInProgress"
		}));
		return;
	}

	// Get expedition data from cache
	const expeditionData = PendingExpeditionsCache.findExpedition(keycloakId, expeditionId);
	if (!expeditionData) {
		response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
			success: false,
			failureReason: "noExpeditionData"
		}));
		return;
	}

	// Remove from cache after successful retrieval
	PendingExpeditionsCache.delete(keycloakId);

	const petModel = PetDataController.instance.getById(petEntity.typeId);
	const rewardIndex = calculateRewardIndex(expeditionData);
	const rationsRequired = ExpeditionConstants.FOOD_CONSUMPTION[rewardIndex];

	// Calculate optimal food consumption plan
	const foodPlan = await calculateFoodConsumptionPlan(player, petModel, rationsRequired);

	let insufficientFood = false;
	let insufficientFoodCause: "noGuild" | "guildNoFood" | undefined;

	if (foodPlan.totalRations < rationsRequired) {
		insufficientFood = true;
		insufficientFoodCause = !player.guildId ? "noGuild" : "guildNoFood";
	}

	// Apply food consumption to guild storage
	if (player.guildId && foodPlan.consumption.length > 0) {
		await applyFoodConsumptionPlan(player.guildId, foodPlan);
	}

	/*
	 * Calculate speed duration modifier based on pet speed
	 * Speed 30 = 0.70 multiplier (30% faster)
	 * Speed 0 = 1.20 multiplier (20% slower)
	 */
	const petSpeed = petModel.speed;
	const speedConfig = ExpeditionConstants.SPEED_DURATION_MODIFIER;
	const speedDurationModifier = speedConfig.MIN_SPEED_MULTIPLIER
		- (petSpeed - speedConfig.MIN_SPEED)
		* (speedConfig.MIN_SPEED_MULTIPLIER - speedConfig.MAX_SPEED_MULTIPLIER)
		/ (speedConfig.MAX_SPEED - speedConfig.MIN_SPEED);

	// Apply speed modifier to duration
	const adjustedDurationMinutes = Math.round(expeditionData.durationMinutes * speedDurationModifier);

	// Create expedition with adjusted duration
	const expedition = PetExpeditions.createExpedition(
		player.id,
		petEntity.id,
		expeditionData,
		adjustedDurationMinutes,
		foodPlan.totalRations
	);
	await expedition.save();

	response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
		success: true,
		expedition: expedition.toExpeditionInProgressData(
			petEntity.typeId,
			petEntity.sex,
			petEntity.nickname ?? undefined
		),
		foodConsumed: foodPlan.totalRations,
		foodConsumedDetails: foodPlanToDetails(foodPlan),
		insufficientFood,
		insufficientFoodCause,
		speedDurationModifier
	}));
}

/**
 * Handle expedition cancellation before departure
 */
async function handleExpeditionCancel(
	player: Player,
	keycloakId: string,
	response: CrowniclesPacket[]
): Promise<void> {
	// Clean up cache
	PendingExpeditionsCache.delete(keycloakId);

	if (!player.petId) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
		return;
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
		return;
	}

	// Apply love loss for cancellation
	const loveLost = Math.abs(ExpeditionConstants.LOVE_CHANGES.CANCEL_BEFORE_DEPARTURE);
	await petEntity.changeLovePoints({
		player,
		amount: ExpeditionConstants.LOVE_CHANGES.CANCEL_BEFORE_DEPARTURE,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});
	await petEntity.save();

	response.push(makePacket(CommandPetExpeditionCancelPacketRes, {
		loveLost,
		petId: petEntity.typeId,
		petSex: petEntity.sex,
		petNickname: petEntity.nickname ?? undefined
	}));
}

/**
 * Handle pet recall during expedition
 */
async function handleExpeditionRecall(
	player: Player,
	response: CrowniclesPacket[]
): Promise<void> {
	// Check for active expedition
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (!activeExpedition) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noExpedition" }));
		return;
	}

	if (!player.petId) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
		return;
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
		return;
	}

	// Recall expedition
	await PetExpeditions.recallExpedition(activeExpedition);

	// Apply love loss for recall
	const loveLost = Math.abs(ExpeditionConstants.LOVE_CHANGES.RECALL_DURING_EXPEDITION);
	await petEntity.changeLovePoints({
		player,
		amount: ExpeditionConstants.LOVE_CHANGES.RECALL_DURING_EXPEDITION,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});
	await petEntity.save();

	response.push(makePacket(CommandPetExpeditionRecallPacketRes, {
		loveLost,
		petId: petEntity.typeId,
		petSex: petEntity.sex,
		petNickname: petEntity.nickname ?? undefined
	}));
}

/**
 * Convert ExpeditionData to ExpeditionOptionData for collector
 */
function convertToExpeditionOptionData(expeditions: ExpeditionData[]): ExpeditionOptionData[] {
	return expeditions.map(exp => ({
		id: exp.id,
		mapLocationId: exp.mapLocationId!,
		locationType: exp.locationType,
		displayDurationMinutes: exp.displayDurationMinutes,
		riskRate: exp.riskRate,
		wealthRate: exp.wealthRate,
		difficulty: exp.difficulty,
		foodCost: exp.foodCost ?? 1,
		isDistantExpedition: exp.isDistantExpedition
	}));
}

export default class PetExpeditionCommand {
	/**
	 * Check expedition status and requirements
	 * Opens either:
	 * - Expedition in progress view with recall option (ReactionCollectorPetExpedition)
	 * - Expedition choice menu (ReactionCollectorPetExpeditionChoice)
	 * - Error/status message for invalid states
	 */
	@commandRequires(CommandPetExpeditionPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async checkStatus(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandPetExpeditionPacketReq,
		context: PacketContext
	): Promise<void> {
		// Check if player has talisman
		if (!player.hasTalisman) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: false,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "noTalisman"
			}));
			return;
		}

		// Check if player has a pet
		if (!player.petId) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "noPet"
			}));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "noPet"
			}));
			return;
		}

		// Check for expedition in progress
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (activeExpedition) {
			const now = Date.now();

			// Check if expedition is complete - show claim rewards menu
			if (now >= activeExpedition.endDate.getTime()) {
				const finishedCollector = new ReactionCollectorPetExpeditionFinished({
					petId: petEntity.typeId,
					petSex: petEntity.sex as SexTypeShort,
					petNickname: petEntity.nickname ?? undefined,
					mapLocationId: activeExpedition.mapLocationId,
					locationType: activeExpedition.locationType as ExpeditionLocationType,
					riskRate: activeExpedition.riskRate,
					foodConsumed: activeExpedition.foodConsumed,
					isDistantExpedition: undefined
				});

				const finishedEndCallback: EndCallback = async (collectorInstance: ReactionCollectorInstance, resp: CrowniclesPacket[]): Promise<void> => {
					const reaction = collectorInstance.getFirstReaction();

					// Unblock player when collector ends
					BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION);

					// Reload player data
					const reloadedPlayer = await Player.findOne({ where: { keycloakId: context.keycloakId } });
					if (!reloadedPlayer) {
						return;
					}

					// If claim was selected, resolve the expedition
					if (reaction && reaction.reaction.type === ReactionCollectorPetExpeditionClaimReaction.name) {
						await PetExpeditionCommand.doResolveExpedition(resp, reloadedPlayer);
					}

					// If timeout, do nothing (player can click expedition again later)
				};

				const finishedCollectorPacket = new ReactionCollectorInstance(
					finishedCollector,
					context,
					{
						allowedPlayerKeycloakIds: [context.keycloakId],
						reactionLimit: 1
					},
					finishedEndCallback
				)
					.block(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION)
					.build();

				response.push(finishedCollectorPacket);
				return;
			}

			// Create collector for expedition in progress with recall option
			const collector = new ReactionCollectorPetExpedition({
				petId: petEntity.typeId,
				petSex: petEntity.sex as SexTypeShort,
				petNickname: petEntity.nickname ?? undefined,
				mapLocationId: activeExpedition.mapLocationId,
				locationType: activeExpedition.locationType as ExpeditionLocationType,
				riskRate: activeExpedition.riskRate,
				returnTime: activeExpedition.endDate.getTime(),
				foodConsumed: activeExpedition.foodConsumed,
				foodConsumedDetails: undefined, // Not stored in DB
				isDistantExpedition: undefined // Not stored in DB, Discord will handle display
			});

			const endCallback: EndCallback = async (collectorInstance: ReactionCollectorInstance, resp: CrowniclesPacket[]): Promise<void> => {
				const reaction = collectorInstance.getFirstReaction();

				// Unblock player when collector ends
				BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION);

				// Reload player data
				const reloadedPlayer = await Player.findOne({ where: { keycloakId: context.keycloakId } });
				if (!reloadedPlayer) {
					return;
				}

				// If recall was selected
				if (reaction && reaction.reaction.type === ReactionCollectorPetExpeditionRecallReaction.name) {
					await handleExpeditionRecall(reloadedPlayer, resp);
				}

				// If close was selected or timeout, do nothing
			};

			const collectorPacket = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [context.keycloakId],
					reactionLimit: 1
				},
				endCallback
			)
				.block(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION)
				.build();

			response.push(collectorPacket);
			return;
		}

		// Check love points requirement
		if (petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "insufficientLove",
				petLovePoints: petEntity.lovePoints,
				petNickname: petEntity.nickname ?? undefined,
				petId: petEntity.typeId,
				petSex: petEntity.sex
			}));
			return;
		}

		// Check if pet is hungry (must be fed before expedition)
		const petModel = PetDataController.instance.getById(petEntity.typeId);
		if (petEntity.getFeedCooldown(petModel) <= 0) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "petHungry",
				petLovePoints: petEntity.lovePoints,
				petNickname: petEntity.nickname ?? undefined,
				petId: petEntity.typeId,
				petSex: petEntity.sex
			}));
			return;
		}

		// Check if player is on continent (can't start expeditions from island, haunted path, etc.)
		if (!Maps.isOnContinent(player)) {
			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: false,
				canStartExpedition: false,
				cannotStartReason: "notOnContinent",
				petNickname: petEntity.nickname ?? undefined,
				petId: petEntity.typeId,
				petSex: petEntity.sex
			}));
			return;
		}

		// All requirements met - generate expeditions and show choice menu
		const expeditions = generateThreeExpeditions(player.mapLinkId);

		// Store expeditions in cache for later retrieval when player makes a choice
		PendingExpeditionsCache.set(context.keycloakId, expeditions);

		// Get guild food information if player has a guild
		let hasGuild = false;
		let guildFoodAmount: number | undefined;

		if (player.guildId) {
			const guild = await Guilds.getById(player.guildId);
			if (guild) {
				hasGuild = true;
				const dietFoodType = petModel.canEatMeat() ? "carnivorousFood" : "herbivorousFood";
				guildFoodAmount = guild.commonFood + guild[dietFoodType] + guild.ultimateFood;
			}
		}

		// Create collector for expedition choice
		const collector = new ReactionCollectorPetExpeditionChoice({
			petId: petEntity.typeId,
			petSex: petEntity.sex as SexTypeShort,
			petNickname: petEntity.nickname ?? undefined,
			expeditions: convertToExpeditionOptionData(expeditions),
			hasGuild,
			guildFoodAmount
		});

		const endCallback: EndCallback = async (collectorInstance: ReactionCollectorInstance, resp: CrowniclesPacket[]): Promise<void> => {
			const reaction = collectorInstance.getFirstReaction();

			// Unblock player when collector ends
			BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION_CHOICE);

			// Reload player data
			const reloadedPlayer = await Player.findOne({ where: { keycloakId: context.keycloakId } });
			if (!reloadedPlayer) {
				return;
			}

			// Reload pet entity
			const reloadedPetEntity = reloadedPlayer.petId ? await PetEntities.getById(reloadedPlayer.petId) : null;

			// If expedition was selected
			if (reaction && reaction.reaction.type === ReactionCollectorPetExpeditionSelectReaction.name) {
				const selectReaction = reaction.reaction.data as ReactionCollectorPetExpeditionSelectReaction;
				if (reloadedPetEntity) {
					await handleExpeditionSelect(
						reloadedPlayer,
						reloadedPetEntity,
						selectReaction.expeditionId,
						context.keycloakId,
						resp
					);
				}
			}
			else {
				// Cancel was selected or timeout
				await handleExpeditionCancel(reloadedPlayer, context.keycloakId, resp);
			}
		};

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [context.keycloakId],
				reactionLimit: 1
			},
			endCallback
		)
			.block(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION_CHOICE)
			.build();

		response.push(collectorPacket);
	}

	/**
	 * Internal method to resolve expedition - used by both the command and the finished collector
	 */
	private static async doResolveExpedition(
		response: CrowniclesPacket[],
		player: Player
	): Promise<void> {
		// Validate prerequisites
		const validation = await validateExpeditionPrerequisites(player.id, player.petId);
		if (validation.success === false) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: validation.errorCode }));
			return;
		}

		const {
			activeExpedition,
			petEntity
		} = validation;
		const petModel = PetDataController.instance.getById(petEntity.typeId);
		const expeditionData = activeExpedition.toExpeditionData();

		// Calculate effective risk and determine outcome
		const effectiveRisk = calculateEffectiveRisk(expeditionData, petModel, petEntity.lovePoints);
		const outcome = determineExpeditionOutcome(effectiveRisk, expeditionData, player.hasCloneTalisman);

		// Apply love change
		if (outcome.loveChange !== 0) {
			await petEntity.changeLovePoints({
				player,
				amount: outcome.loveChange,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			await petEntity.save();
		}

		// Apply rewards
		if (outcome.rewards) {
			await applyExpeditionRewards(outcome.rewards, player, response);
		}

		await player.save();

		// Mark expedition as completed
		await PetExpeditions.completeExpedition(activeExpedition);

		response.push(makePacket(CommandPetExpeditionResolvePacketRes, {
			success: !outcome.totalFailure,
			partialSuccess: outcome.partialSuccess,
			totalFailure: outcome.totalFailure,
			rewards: outcome.rewards,
			loveChange: outcome.loveChange,
			petId: petEntity.typeId,
			petSex: petEntity.sex,
			petNickname: petEntity.nickname ?? undefined,
			expedition: expeditionData
		}));
	}

	/**
	 * Resolve a completed expedition
	 */
	@commandRequires(CommandPetExpeditionResolvePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async resolveExpedition(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandPetExpeditionResolvePacketReq
	): Promise<void> {
		await PetExpeditionCommand.doResolveExpedition(response, player);
	}
}
