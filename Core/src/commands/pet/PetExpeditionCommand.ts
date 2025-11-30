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
import {
	PetExpedition, PetExpeditions
} from "../../core/database/game/models/PetExpedition";
import {
	Pet, PetDataController
} from "../../data/Pet";
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
	generateThreeExpeditions,
	calculateFoodConsumptionPlan,
	applyFoodConsumptionPlan,
	calculateEffectiveRisk,
	determineExpeditionOutcome,
	validateExpeditionPrerequisites,
	applyExpeditionRewards,
	FoodConsumptionPlan,
	calculateRewardIndex,
	PendingExpeditionsCache,
	FOOD_RATION_VALUES
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
import { Badge } from "../../../../Lib/src/types/Badge";
import { crowniclesInstance } from "../../index";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";

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
 * Context for handling expedition selection
 */
interface ExpeditionSelectContext {
	player: Player;
	petEntity: PetEntity;
	expeditionId: string;
	keycloakId: string;
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
	if (!player.hasTalisman || !player.petId) {
		return createExpeditionSelectFailure("invalidState");
	}

	// Retrieve expedition data from cache
	const expeditionData = PendingExpeditionsCache.findExpedition(keycloakId, expeditionId);
	if (!expeditionData) {
		return createExpeditionSelectFailure("invalidState");
	}

	// Check no expedition in progress
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
	if (activeExpedition) {
		return createExpeditionSelectFailure("expeditionInProgress");
	}

	return null;
}

/**
 * Calculate speed duration modifier based on pet speed
 */
function calculateSpeedDurationModifier(petSpeed: number): number {
	const speedConfig = ExpeditionConstants.SPEED_DURATION_MODIFIER;
	return speedConfig.MIN_SPEED_MULTIPLIER
		- (petSpeed - speedConfig.MIN_SPEED)
		* (speedConfig.MIN_SPEED_MULTIPLIER - speedConfig.MAX_SPEED_MULTIPLIER)
		/ (speedConfig.MAX_SPEED - speedConfig.MIN_SPEED);
}

/**
 * Handle expedition choice selection
 */
async function handleExpeditionSelect(
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
	const petModel = PetDataController.instance.getById(petEntity.typeId);
	const rationsRequired = expeditionData.foodCost ?? 1;

	// Calculate optimal food consumption plan
	const foodPlan = await calculateFoodConsumptionPlan(player, petModel, rationsRequired);

	const insufficientFood = foodPlan.totalRations < rationsRequired;
	const insufficientFoodCause = insufficientFood
		? !player.guildId ? "noGuild" : "guildNoFood"
		: undefined;

	// Apply food consumption to guild storage
	if (player.guildId && foodPlan.consumption.length > 0) {
		await applyFoodConsumptionPlan(player.guildId, foodPlan);
	}

	// Calculate speed modifier and adjusted duration
	const speedDurationModifier = calculateSpeedDurationModifier(petModel.speed);
	const adjustedDurationMinutes = Math.round(expeditionData.durationMinutes * speedDurationModifier);

	// Calculate reward index once (based on original expedition data, before speed adjustment)
	const rewardIndex = calculateRewardIndex(expeditionData);

	// Create expedition with adjusted duration and stored reward index
	const expedition = PetExpeditions.createExpedition({
		playerId: player.id,
		petId: petEntity.id,
		expeditionData,
		durationMinutes: adjustedDurationMinutes,
		foodConsumed: foodPlan.totalRations,
		rewardIndex
	});
	await expedition.save();

	// Log expedition start to database
	crowniclesInstance.logsDatabase.logExpeditionStart(
		player.keycloakId,
		petEntity.id,
		expeditionData.mapLocationId!,
		expeditionData.locationType,
		adjustedDurationMinutes,
		foodPlan.totalRations
	).then();

	// Clean up the pending expeditions cache
	PendingExpeditionsCache.delete(keycloakId);

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
		speedDurationModifier,
		originalDisplayDurationMinutes: expeditionData.displayDurationMinutes
	}));
}

/**
 * Handle expedition cancellation before departure
 */
async function handleExpeditionCancel(
	player: Player,
	response: CrowniclesPacket[]
): Promise<void> {
	if (!player.petId) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
		return;
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: "noPet" }));
		return;
	}

	// Calculate progressive penalty based on recent cancellations
	const recentCancellations = await crowniclesInstance.logsDatabase.countRecentExpeditionCancellations(
		player.keycloakId,
		ExpeditionConstants.CANCELLATION_PENALTY.LOOKBACK_DAYS
	);

	// Love lost = base * (1 + recentCancellations)
	const baseLoveLost = Math.abs(ExpeditionConstants.LOVE_CHANGES.CANCEL_BEFORE_DEPARTURE_BASE);
	const loveLost = baseLoveLost * (1 + recentCancellations);
	const loveChange = -loveLost;

	// Log expedition cancellation to database
	crowniclesInstance.logsDatabase.logExpeditionCancel(
		player.keycloakId,
		petEntity.id,
		loveChange
	).then();

	// Apply love loss for cancellation
	await petEntity.changeLovePoints({
		player,
		amount: loveChange,
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

	// Calculate progressive penalty based on recent cancellations (includes both cancel and recall)
	const recentCancellations = await crowniclesInstance.logsDatabase.countRecentExpeditionCancellations(
		player.keycloakId,
		ExpeditionConstants.CANCELLATION_PENALTY.LOOKBACK_DAYS
	);

	// Love lost = base * (1 + recentCancellations)
	const baseLoveLost = Math.abs(ExpeditionConstants.LOVE_CHANGES.RECALL_DURING_EXPEDITION);
	const loveLost = baseLoveLost * (1 + recentCancellations);
	const loveChange = -loveLost;

	// Log expedition recall to database
	crowniclesInstance.logsDatabase.logExpeditionRecall(
		player.keycloakId,
		petEntity.id,
		activeExpedition.mapLocationId,
		activeExpedition.locationType,
		loveChange
	).then();

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
		durationMinutes: exp.durationMinutes,
		displayDurationMinutes: exp.displayDurationMinutes,
		riskRate: exp.riskRate,
		difficulty: exp.difficulty,
		foodCost: exp.foodCost ?? 1,
		rewardIndex: calculateRewardIndex(exp),
		isDistantExpedition: exp.isDistantExpedition,
		hasCloneTalismanBonus: exp.hasCloneTalismanBonus
	}));
}

/**
 * Build a "cannot start expedition" response packet
 */
function buildCannotStartResponse(
	reason: string,
	hasTalisman: boolean,
	petEntity?: PetEntity
): CommandPetExpeditionPacketRes {
	return makePacket(CommandPetExpeditionPacketRes, {
		hasTalisman,
		hasExpeditionInProgress: false,
		canStartExpedition: false,
		cannotStartReason: reason,
		petLovePoints: petEntity?.lovePoints,
		petNickname: petEntity?.nickname ?? undefined,
		petId: petEntity?.typeId,
		petSex: petEntity?.sex
	});
}

/**
 * Build and return a blocking reaction collector for pet expedition
 */
function buildExpeditionCollector(
	collector: ReactionCollectorPetExpedition | ReactionCollectorPetExpeditionFinished,
	context: PacketContext,
	endCallback: EndCallback
): CrowniclesPacket {
	return new ReactionCollectorInstance(
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
}

/**
 * Common data for expedition collector creation
 */
interface ExpeditionCollectorData {
	petEntity: PetEntity;
	activeExpedition: PetExpedition;
	context: PacketContext;
}

/**
 * Create common end callback logic for expedition collectors
 */
function createExpeditionEndCallback(
	context: PacketContext,
	reactionHandler: (reaction: { reaction: { type: string } } | undefined, player: Player, resp: CrowniclesPacket[]) => Promise<void>
): EndCallback {
	return async (collectorInstance: ReactionCollectorInstance, resp: CrowniclesPacket[]): Promise<void> => {
		const reaction = collectorInstance.getFirstReaction();
		BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION);

		const reloadedPlayer = await Player.findOne({ where: { keycloakId: context.keycloakId } });
		if (!reloadedPlayer) {
			return;
		}

		await reactionHandler(reaction, reloadedPlayer, resp);
	};
}

/**
 * Create the finished expedition collector with claim option
 */
function createFinishedExpeditionCollector(data: ExpeditionCollectorData): CrowniclesPacket {
	const {
		petEntity, activeExpedition, context
	} = data;

	const collector = new ReactionCollectorPetExpeditionFinished({
		petId: petEntity.typeId,
		petSex: petEntity.sex as SexTypeShort,
		petNickname: petEntity.nickname ?? undefined,
		mapLocationId: activeExpedition.mapLocationId,
		locationType: activeExpedition.locationType as ExpeditionLocationType,
		riskRate: activeExpedition.riskRate,
		foodConsumed: activeExpedition.foodConsumed,
		isDistantExpedition: undefined
	});

	const endCallback = createExpeditionEndCallback(context, async (reaction, player, resp) => {
		if (reaction?.reaction.type === ReactionCollectorPetExpeditionClaimReaction.name) {
			await PetExpeditionCommand.doResolveExpedition(resp, player, context);
		}
	});

	return buildExpeditionCollector(collector, context, endCallback);
}

/**
 * Create the in-progress expedition collector with recall option
 */
function createInProgressExpeditionCollector(data: ExpeditionCollectorData): CrowniclesPacket {
	const {
		petEntity, activeExpedition, context
	} = data;

	const collector = new ReactionCollectorPetExpedition({
		petId: petEntity.typeId,
		petSex: petEntity.sex as SexTypeShort,
		petNickname: petEntity.nickname ?? undefined,
		mapLocationId: activeExpedition.mapLocationId,
		locationType: activeExpedition.locationType as ExpeditionLocationType,
		riskRate: activeExpedition.riskRate,
		returnTime: activeExpedition.endDate.getTime(),
		foodConsumed: activeExpedition.foodConsumed,
		foodConsumedDetails: undefined,
		isDistantExpedition: undefined
	});

	const endCallback = createExpeditionEndCallback(context, async (reaction, player, resp) => {
		if (reaction?.reaction.type === ReactionCollectorPetExpeditionRecallReaction.name) {
			await handleExpeditionRecall(player, resp);
		}
	});

	return buildExpeditionCollector(collector, context, endCallback);
}

/**
 * Get guild food amount for a player's pet
 */
async function getGuildFoodInfo(player: Player, petModel: Pet): Promise<{
	hasGuild: boolean;
	guildFoodAmount?: number;
}> {
	if (!player.guildId) {
		return { hasGuild: false };
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return { hasGuild: false };
	}

	const dietFoodType = petModel.canEatMeat() ? "carnivorousFood" : "herbivorousFood";
	return {
		hasGuild: true,
		guildFoodAmount: guild.commonFood * FOOD_RATION_VALUES.commonFood
			+ guild[dietFoodType] * FOOD_RATION_VALUES[dietFoodType]
			+ guild.ultimateFood * FOOD_RATION_VALUES.ultimateFood
	};
}

/**
 * Parameters for creating expedition choice collector
 */
interface ExpeditionChoiceParams {
	petEntity: PetEntity;
	expeditions: ExpeditionData[];
	guildInfo: {
		hasGuild: boolean;
		guildFoodAmount?: number;
	};
	context: PacketContext;
}

/**
 * Create the expedition choice collector
 */
function createExpeditionChoiceCollector(params: ExpeditionChoiceParams): CrowniclesPacket {
	const {
		petEntity, expeditions, guildInfo, context
	} = params;

	const collector = new ReactionCollectorPetExpeditionChoice({
		petId: petEntity.typeId,
		petSex: petEntity.sex as SexTypeShort,
		petNickname: petEntity.nickname ?? undefined,
		expeditions: convertToExpeditionOptionData(expeditions),
		hasGuild: guildInfo.hasGuild,
		guildFoodAmount: guildInfo.guildFoodAmount
	});

	const endCallback: EndCallback = async (collectorInstance: ReactionCollectorInstance, resp: CrowniclesPacket[]): Promise<void> => {
		const reaction = collectorInstance.getFirstReaction();
		BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION_CHOICE);

		const reloadedPlayer = await Player.findOne({ where: { keycloakId: context.keycloakId } });
		if (!reloadedPlayer) {
			return;
		}

		const reloadedPetEntity = reloadedPlayer.petId ? await PetEntities.getById(reloadedPlayer.petId) : null;

		if (reaction?.reaction.type === ReactionCollectorPetExpeditionSelectReaction.name) {
			const selectReaction = reaction.reaction.data as ReactionCollectorPetExpeditionSelectReaction;
			if (reloadedPetEntity) {
				await handleExpeditionSelect({
					player: reloadedPlayer,
					petEntity: reloadedPetEntity,
					expeditionId: selectReaction.expedition.id,
					keycloakId: context.keycloakId
				}, resp);
			}
		}
		else {
			await handleExpeditionCancel(reloadedPlayer, resp);
		}
	};

	return new ReactionCollectorInstance(
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
}

/**
 * Check basic requirements (talisman and pet)
 */
async function checkBasicRequirements(player: Player): Promise<CommandPetExpeditionPacketRes | null> {
	if (!player.hasTalisman) {
		return buildCannotStartResponse("noTalisman", false);
	}

	if (!player.petId) {
		return buildCannotStartResponse("noPet", true);
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		return buildCannotStartResponse("noPet", true);
	}

	return null;
}

/**
 * Handle active expedition - show finished or in-progress collector
 */
function handleActiveExpedition(
	petEntity: PetEntity,
	activeExpedition: PetExpedition,
	context: PacketContext
): CrowniclesPacket {
	const isComplete = Date.now() >= activeExpedition.endDate.getTime();
	const data: ExpeditionCollectorData = {
		petEntity,
		activeExpedition,
		context
	};
	return isComplete
		? createFinishedExpeditionCollector(data)
		: createInProgressExpeditionCollector(data);
}

/**
 * Check requirements to start a new expedition
 */
function checkStartRequirements(
	player: Player,
	petEntity: PetEntity,
	petModel: Pet
): CommandPetExpeditionPacketRes | null {
	if (petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
		return buildCannotStartResponse("insufficientLove", true, petEntity);
	}

	if (petEntity.getFeedCooldown(petModel) <= 0) {
		return buildCannotStartResponse("petHungry", true, petEntity);
	}

	if (!Maps.isOnContinent(player)) {
		return buildCannotStartResponse("notOnContinent", true, petEntity);
	}

	return null;
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
		// Check basic requirements
		const basicCheckResult = await checkBasicRequirements(player);
		if (basicCheckResult) {
			response.push(basicCheckResult);
			return;
		}

		const petEntity = (await PetEntities.getById(player.petId!))!;
		const petModel = PetDataController.instance.getById(petEntity.typeId);

		// Handle expedition in progress
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (activeExpedition) {
			response.push(handleActiveExpedition(petEntity, activeExpedition, context));
			return;
		}

		// Check expedition start requirements
		const startCheckResult = checkStartRequirements(player, petEntity, petModel);
		if (startCheckResult) {
			response.push(startCheckResult);
			return;
		}

		// All requirements met - show expedition choice
		const guildInfo = await getGuildFoodInfo(player, petModel);
		const expeditions = generateThreeExpeditions(player.mapLinkId, player.hasCloneTalisman);

		// Store expeditions in cache for later retrieval
		PendingExpeditionsCache.set(context.keycloakId, expeditions);

		response.push(createExpeditionChoiceCollector({
			petEntity,
			expeditions,
			guildInfo,
			context
		}));
	}

	/**
	 * Internal method to resolve expedition - used by both the command and the finished collector
	 */
	static async doResolveExpedition(
		response: CrowniclesPacket[],
		player: Player,
		context: PacketContext
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

		// Calculate effective risk and determine outcome using stored rewardIndex
		const effectiveRisk = calculateEffectiveRisk(expeditionData, petModel, petEntity.lovePoints);
		const outcome = determineExpeditionOutcome(effectiveRisk, expeditionData, activeExpedition.rewardIndex, player.hasCloneTalisman);

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
			await applyExpeditionRewards(outcome.rewards, player, response, context);
		}

		await player.save();

		// Mark expedition as completed
		await PetExpeditions.completeExpedition(activeExpedition);

		// Log expedition completion to database
		crowniclesInstance.logsDatabase.logExpeditionComplete(
			player.keycloakId,
			petEntity.id,
			expeditionData.mapLocationId!,
			expeditionData.locationType,
			expeditionData.durationMinutes,
			activeExpedition.foodConsumed,
			!outcome.totalFailure,
			outcome.rewards,
			outcome.loveChange
		).then();

		// Check for expert expediteur badge (only for successful expeditions)
		let badgeEarned: string | undefined;
		if (!outcome.totalFailure && !player.hasBadge(Badge.EXPERT_EXPEDITEUR)) {
			const successfulExpeditions = await LogsReadRequests.countSuccessfulExpeditions(player.keycloakId);
			if (successfulExpeditions >= ExpeditionConstants.BADGE.EXPERT_EXPEDITEUR_THRESHOLD) {
				player.addBadge(Badge.EXPERT_EXPEDITEUR);
				await player.save();
				badgeEarned = Badge.EXPERT_EXPEDITEUR;
			}
		}

		response.push(makePacket(CommandPetExpeditionResolvePacketRes, {
			success: !outcome.totalFailure,
			partialSuccess: outcome.partialSuccess,
			totalFailure: outcome.totalFailure,
			rewards: outcome.rewards,
			loveChange: outcome.loveChange,
			petId: petEntity.typeId,
			petSex: petEntity.sex,
			petNickname: petEntity.nickname ?? undefined,
			expedition: expeditionData,
			badgeEarned
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
		_packet: CommandPetExpeditionResolvePacketReq,
		context: PacketContext
	): Promise<void> {
		await PetExpeditionCommand.doResolveExpedition(response, player, context);
	}
}
