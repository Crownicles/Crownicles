import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { PetExpeditions } from "../../core/database/game/models/PetExpedition";
import { PetDataController } from "../../data/Pet";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { Guilds } from "../../core/database/game/models/Guild";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	CommandPetExpeditionPacketReq,
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionGeneratePacketReq,
	CommandPetExpeditionGeneratePacketRes,
	CommandPetExpeditionChoicePacketReq,
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionCancelPacketReq,
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketReq,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionResolvePacketReq,
	CommandPetExpeditionResolvePacketRes,
	CommandPetExpeditionErrorPacket
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
	applyExpeditionRewards
} from "../../core/expeditions";

export default class PetExpeditionCommand {
	/**
	 * Check expedition status and requirements
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
			// Block player while viewing expedition with recall option
			BlockingUtils.blockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION, Constants.MESSAGES.COLLECTOR_TIME);

			response.push(makePacket(CommandPetExpeditionPacketRes, {
				hasTalisman: true,
				hasExpeditionInProgress: true,
				expeditionInProgress: activeExpedition.toExpeditionInProgressData(
					petEntity.typeId,
					petEntity.sex,
					petEntity.nickname ?? undefined
				),
				canStartExpedition: false,
				petLovePoints: petEntity.lovePoints
			}));
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

		// All requirements met
		response.push(makePacket(CommandPetExpeditionPacketRes, {
			hasTalisman: true,
			hasExpeditionInProgress: false,
			canStartExpedition: true,
			petLovePoints: petEntity.lovePoints,
			petNickname: petEntity.nickname ?? undefined,
			petId: petEntity.typeId,
			petSex: petEntity.sex
		}));
	}

	/**
	 * Generate 3 expedition options
	 */
	@commandRequires(CommandPetExpeditionGeneratePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async generateExpeditions(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandPetExpeditionGeneratePacketReq,
		context: PacketContext
	): Promise<void> {
		// Validate requirements
		if (!player.hasTalisman || !player.petId) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "invalidState" }));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity || petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "invalidState" }));
			return;
		}

		// Check no expedition in progress
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (activeExpedition) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "expeditionInProgress" }));
			return;
		}

		// Generate 3 expeditions based on player's current map position
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
				const petModel = PetDataController.instance.getById(petEntity.typeId);
				const dietFoodType = petModel.canEatMeat() ? "carnivorousFood" : "herbivorousFood";
				guildFoodAmount = guild.commonFood + guild[dietFoodType] + guild.ultimateFood;
			}
		}

		// Block player while choosing expedition
		BlockingUtils.blockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION_CHOICE, Constants.MESSAGES.COLLECTOR_TIME);

		response.push(makePacket(CommandPetExpeditionGeneratePacketRes, {
			expeditions,
			petId: petEntity.typeId,
			petSex: petEntity.sex,
			petNickname: petEntity.nickname ?? undefined,
			hasGuild,
			guildFoodAmount
		}));
	}

	/**
	 * Start a selected expedition
	 */
	@commandRequires(CommandPetExpeditionChoicePacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async startExpedition(
		response: CrowniclesPacket[],
		player: Player,
		packet: CommandPetExpeditionChoicePacketReq,
		context: PacketContext
	): Promise<void> {
		// Unblock player from expedition choice
		BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION_CHOICE);

		// Validate requirements
		if (!player.hasTalisman || !player.petId) {
			response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
				success: false,
				failureReason: "invalidState"
			}));
			return;
		}

		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity || petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
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
		const expeditionData = PendingExpeditionsCache.findExpedition(context.keycloakId, packet.expeditionId);
		if (!expeditionData) {
			response.push(makePacket(CommandPetExpeditionChoicePacketRes, {
				success: false,
				failureReason: "noExpeditionData"
			}));
			return;
		}

		// Remove from cache after successful retrieval
		PendingExpeditionsCache.delete(context.keycloakId);

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

		// Create expedition
		const expedition = PetExpeditions.createExpedition(
			player.id,
			petEntity.id,
			expeditionData,
			expeditionData.durationMinutes,
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
			insufficientFood,
			insufficientFoodCause
		}));
	}

	/**
	 * Cancel expedition before departure
	 */
	@commandRequires(CommandPetExpeditionCancelPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async cancelExpedition(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandPetExpeditionCancelPacketReq,
		context: PacketContext
	): Promise<void> {
		// Unblock player from expedition choice
		BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION_CHOICE);
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
	 * Recall pet during expedition
	 */
	@commandRequires(CommandPetExpeditionRecallPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async recallPet(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandPetExpeditionRecallPacketReq,
		context: PacketContext
	): Promise<void> {
		// Unblock player from expedition view
		BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION);

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
}
