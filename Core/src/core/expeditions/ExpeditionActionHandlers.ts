import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../database/game/models/Player";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import {
	PetExpedition, PetExpeditions
} from "../database/game/models/PetExpedition";
import { PetDataController } from "../../data/Pet";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionErrorPacket,
	ExpeditionData,
	FoodConsumptionDetail
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	calculateFoodConsumptionPlan,
	applyFoodConsumptionPlan,
	type FoodConsumptionPlan
} from "./ExpeditionFoodService";
import { calculateRewardIndex } from "./ExpeditionRewardCalculator";
import { PendingExpeditionsCache } from "./PendingExpeditionsCache";
import { crowniclesInstance } from "../../index";
import { ScheduledExpeditionNotifications } from "../database/game/models/ScheduledExpeditionNotification";
import { PlayerTalismansManager } from "../database/game/models/PlayerTalismans";

/**
 * Context for handling expedition selection
 */
export interface ExpeditionSelectContext {
	player: Player;
	petEntity: PetEntity;
	expeditionId: string;
	keycloakId: string;
}

/**
 * Parameters for building expedition select success response
 */
interface ExpeditionSelectSuccessParams {
	expedition: PetExpedition;
	petEntity: PetEntity;
	foodPlan: FoodConsumptionPlan;
	rationsRequired: number;
	speedDurationModifier: number;
	originalDisplayDurationMinutes: number;
	hasGuild: boolean;
}

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
 * Calculate progressive love loss based on recent cancellations
 * First cancellation of the week is free, then Love lost = base * recentCancellations, capped at MAX_CANCELLATION_LOVE_LOSS
 */
function calculateProgressiveLoveLoss(baseLoveLost: number, recentCancellations: number): number {
	const loveLost = Math.abs(baseLoveLost) * recentCancellations;
	return Math.min(loveLost, ExpeditionConstants.CAPS.MAX_CANCELLATION_LOVE_LOSS);
}

/**
 * Calculate speed duration modifier based on pet speed
 * Higher speed = lower multiplier = faster expedition
 */
function calculateSpeedDurationModifier(petSpeed: number): number {
	const speedConfig = ExpeditionConstants.SPEED_DURATION_MODIFIER;
	return speedConfig.BASE_MULTIPLIER - petSpeed * speedConfig.REDUCTION_PER_SPEED_POINT;
}

/**
 * Create a failure response packet for expedition selection
 */
function createExpeditionSelectFailure(failureReason: string): CommandPetExpeditionChoicePacketRes {
	return makePacket(CommandPetExpeditionChoicePacketRes, {
		success: false,
		failureReason
	});
}

/**
 * Validate expedition selection prerequisites
 * Returns a failure packet if validation fails, null if all checks pass
 */
async function validateExpeditionSelection(
	ctx: ExpeditionSelectContext
): Promise<CommandPetExpeditionChoicePacketRes | null> {
	const {
		player, keycloakId, expeditionId
	} = ctx;

	// Validate requirements
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	if (!talismans.hasTalisman || !player.petId) {
		return createExpeditionSelectFailure(ExpeditionConstants.ERROR_CODES.INVALID_STATE);
	}

	// Retrieve expedition data from cache
	const expeditionData = PendingExpeditionsCache.findExpedition(keycloakId, expeditionId);
	if (!expeditionData) {
		return createExpeditionSelectFailure(ExpeditionConstants.ERROR_CODES.INVALID_STATE);
	}

	// Check no expedition in progress
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (activeExpedition) {
		return createExpeditionSelectFailure(ExpeditionConstants.ERROR_CODES.EXPEDITION_IN_PROGRESS);
	}

	return null;
}

/**
 * Data for creating and starting an expedition
 */
interface ExpeditionCreationData {
	player: Player;
	petEntity: PetEntity;
	expeditionData: ExpeditionData;
	foodPlan: FoodConsumptionPlan;
	adjustedDurationMinutes: number;
	rewardIndex: number;
}

/**
 * Create and save expedition to database
 */
async function createAndSaveExpedition(data: ExpeditionCreationData): Promise<PetExpedition> {
	const {
		player, petEntity, expeditionData, foodPlan, adjustedDurationMinutes, rewardIndex
	} = data;

	const expedition = PetExpeditions.createExpedition({
		playerId: player.id,
		petId: petEntity.id,
		expeditionData,
		durationMinutes: adjustedDurationMinutes,
		foodConsumed: foodPlan.totalRations,
		rewardIndex
	});
	await expedition.save();

	// Schedule notification for when the expedition ends
	await ScheduledExpeditionNotifications.scheduleNotification({
		expeditionId: expedition.id,
		keycloakId: player.keycloakId,
		petId: petEntity.typeId,
		petSex: petEntity.sex,
		petNickname: petEntity.nickname,
		scheduledAt: expedition.endDate
	});

	return expedition;
}

/**
 * Parameters for logging expedition start
 */
interface ExpeditionLogStartParams {
	playerKeycloakId: string;
	petEntityId: number;
	expeditionData: ExpeditionData;
	adjustedDurationMinutes: number;
	foodConsumed: number;
	rewardIndex: number;
}

/**
 * Log expedition start to database
 */
function logExpeditionStart(params: ExpeditionLogStartParams): void {
	const {
		playerKeycloakId, petEntityId, expeditionData, adjustedDurationMinutes, foodConsumed, rewardIndex
	} = params;

	crowniclesInstance?.logsDatabase.logExpeditionStart(
		playerKeycloakId,
		petEntityId,
		{
			mapLocationId: expeditionData.mapLocationId!,
			locationType: expeditionData.locationType,
			durationMinutes: adjustedDurationMinutes,
			foodConsumed,
			rewardIndex
		}
	).then();
}

/**
 * Build the success response packet for expedition selection
 */
function buildExpeditionSelectSuccessResponse(params: ExpeditionSelectSuccessParams): CommandPetExpeditionChoicePacketRes {
	const {
		expedition, petEntity, foodPlan, rationsRequired, speedDurationModifier, originalDisplayDurationMinutes, hasGuild
	} = params;
	const insufficientFood = foodPlan.totalRations < rationsRequired;

	return makePacket(CommandPetExpeditionChoicePacketRes, {
		success: true,
		expedition: expedition.toExpeditionInProgressData(petEntity.getBasicInfo()),
		foodConsumed: foodPlan.totalRations,
		foodConsumedDetails: foodPlanToDetails(foodPlan),
		insufficientFood,
		insufficientFoodCause: insufficientFood
			? !hasGuild ? ExpeditionConstants.INSUFFICIENT_FOOD_CAUSES.NO_GUILD : ExpeditionConstants.INSUFFICIENT_FOOD_CAUSES.GUILD_NO_FOOD
			: undefined,
		speedDurationModifier,
		originalDisplayDurationMinutes
	});
}

/**
 * Handle expedition choice selection
 */
export async function handleExpeditionSelect(
	ctx: ExpeditionSelectContext,
	response: CrowniclesPacket[]
): Promise<void> {
	const {
		player, petEntity, expeditionId, keycloakId
	} = ctx;

	// Validate prerequisites
	const validationError = await validateExpeditionSelection(ctx);
	if (validationError) {
		response.push(validationError);
		return;
	}

	const expeditionData = PendingExpeditionsCache.findExpedition(keycloakId, expeditionId)!;
	const petModel = PetDataController.instance.getById(petEntity.typeId)!;
	const rationsRequired = expeditionData.foodCost ?? ExpeditionConstants.DEFAULT_FOOD_COST;

	// Calculate optimal food consumption plan
	const foodPlan = await calculateFoodConsumptionPlan(player, petModel, rationsRequired);

	// Apply food consumption to guild storage (even if insufficient, consume what's available)
	if (player.guildId && foodPlan.consumption.length > 0) {
		await applyFoodConsumptionPlan(player.guildId, foodPlan);
	}

	// Calculate speed modifier and adjusted duration
	const speedDurationModifier = calculateSpeedDurationModifier(petModel.speed);
	const adjustedDurationMinutes = Math.round(expeditionData.durationMinutes * speedDurationModifier);
	const rewardIndex = calculateRewardIndex(expeditionData);

	// Create and save expedition
	const expedition = await createAndSaveExpedition({
		player,
		petEntity,
		expeditionData,
		foodPlan,
		adjustedDurationMinutes,
		rewardIndex
	});

	// Log and clean up
	logExpeditionStart({
		playerKeycloakId: player.keycloakId,
		petEntityId: petEntity.id,
		expeditionData,
		adjustedDurationMinutes,
		foodConsumed: foodPlan.totalRations,
		rewardIndex
	});
	PendingExpeditionsCache.delete(keycloakId);

	response.push(buildExpeditionSelectSuccessResponse({
		expedition,
		petEntity,
		foodPlan,
		rationsRequired,
		speedDurationModifier,
		originalDisplayDurationMinutes: expeditionData.displayDurationMinutes,
		hasGuild: Boolean(player.guildId)
	}));
}

/**
 * Handle expedition cancellation before departure
 */
export async function handleExpeditionCancel(
	player: Player,
	response: CrowniclesPacket[]
): Promise<void> {
	if (!player.petId) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: ExpeditionConstants.ERROR_CODES.NO_PET }));
		return;
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: ExpeditionConstants.ERROR_CODES.NO_PET }));
		return;
	}

	// Calculate progressive penalty based on recent cancellations
	const recentCancellations = await crowniclesInstance?.logsDatabase.countRecentExpeditionCancellations(
		player.keycloakId,
		ExpeditionConstants.CANCELLATION_PENALTY.LOOKBACK_DAYS
	) ?? 0;

	const loveLost = calculateProgressiveLoveLoss(
		ExpeditionConstants.LOVE_CHANGES.CANCEL_BEFORE_DEPARTURE_BASE,
		recentCancellations
	);
	const loveChange = -loveLost;

	// Log expedition cancellation to database
	crowniclesInstance?.logsDatabase.logExpeditionCancel(
		player.keycloakId,
		petEntity.id,
		loveChange
	).then();

	// Determine if this is a free cancellation
	const isFreeCancellation = recentCancellations === 0;

	// Apply love loss for cancellation (only if not free)
	if (!isFreeCancellation) {
		await petEntity.changeLovePoints({
			player,
			amount: loveChange,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await petEntity.save();
	}

	response.push(makePacket(CommandPetExpeditionCancelPacketRes, {
		loveLost,
		isFreeCancellation,
		pet: petEntity.getBasicInfo()
	}));
}

/**
 * Handle pet recall during expedition
 */
export async function handleExpeditionRecall(
	player: Player,
	response: CrowniclesPacket[]
): Promise<void> {
	// Check for active expedition
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (!activeExpedition) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: ExpeditionConstants.ERROR_CODES.NO_EXPEDITION }));
		return;
	}

	if (!player.petId) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: ExpeditionConstants.ERROR_CODES.NO_PET }));
		return;
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: ExpeditionConstants.ERROR_CODES.NO_PET }));
		return;
	}

	// Calculate progressive penalty based on recent cancellations (includes both cancel and recall)
	const recentCancellations = await crowniclesInstance?.logsDatabase.countRecentExpeditionCancellations(
		player.keycloakId,
		ExpeditionConstants.CANCELLATION_PENALTY.LOOKBACK_DAYS
	) ?? 0;

	const loveLost = calculateProgressiveLoveLoss(
		ExpeditionConstants.LOVE_CHANGES.RECALL_DURING_EXPEDITION,
		recentCancellations
	);
	const loveChange = -loveLost;

	// Log expedition recall to database
	crowniclesInstance?.logsDatabase.logExpeditionRecall(
		player.keycloakId,
		petEntity.id,
		{
			mapLocationId: activeExpedition.mapLocationId,
			locationType: activeExpedition.locationType,
			loveChange
		}
	).then();

	// Cancel the scheduled notification for this expedition
	await ScheduledExpeditionNotifications.deleteByExpeditionId(activeExpedition.id);

	// Recall expedition
	await PetExpeditions.recallExpedition(activeExpedition);

	// Apply love loss for recall with progressive penalty
	await petEntity.changeLovePoints({
		player,
		amount: loveChange,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});
	await petEntity.save();

	response.push(makePacket(CommandPetExpeditionRecallPacketRes, {
		loveLost,
		pet: petEntity.getBasicInfo()
	}));
}
