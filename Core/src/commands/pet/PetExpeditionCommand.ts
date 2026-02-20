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
import { PlayerTalismansManager } from "../../core/database/game/models/PlayerTalismans";
import { PetDataController } from "../../data/Pet";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	CommandPetExpeditionPacketReq,
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionResolvePacketReq,
	CommandPetExpeditionResolvePacketRes,
	CommandPetExpeditionErrorPacket,
	ExpeditionData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	generateThreeExpeditions,
	calculateEffectiveRisk,
	determineExpeditionOutcome
} from "../../core/expeditions/ExpeditionService";
import { validateExpeditionPrerequisites } from "../../core/expeditions/ExpeditionValidation";
import { applyExpeditionRewards } from "../../core/expeditions/ExpeditionRewardApplicator";
import { PendingExpeditionsCache } from "../../core/expeditions/PendingExpeditionsCache";
import { Maps } from "../../core/maps/Maps";
import { Badge } from "../../../../Lib/src/types/Badge";
import { crowniclesInstance } from "../../index";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import { ScheduledExpeditionNotifications } from "../../core/database/game/models/ScheduledExpeditionNotification";
import {
	buildCannotStartResponse,
	createExpeditionChoiceCollector,
	getGuildFoodInfo,
	handleActiveExpedition,
	setResolveExpeditionFunction
} from "../../core/expeditions/ExpeditionCollectorFactory";
import { BlessingManager } from "../../core/blessings/BlessingManager";
import { MissionsController } from "../../core/missions/MissionsController";
import { MissionSlots } from "../../core/database/game/models/MissionSlot";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../core/database/game/models/PlayerActiveObjects";

/**
 * Expedition log parameters
 */
interface ExpeditionLogParams {
	mapLocationId: number;
	locationType: string;
	durationMinutes: number;
	foodConsumed: number;
	rewardIndex: number;
	success: boolean;
}

/**
 * Extract expedition log parameters from expedition data and active expedition
 */
function extractExpeditionLogParams(
	expeditionData: ExpeditionData,
	activeExpedition: PetExpedition,
	success: boolean
): ExpeditionLogParams {
	return {
		mapLocationId: expeditionData.mapLocationId!,
		locationType: expeditionData.locationType,
		durationMinutes: expeditionData.durationMinutes,
		foodConsumed: activeExpedition.foodConsumed,
		rewardIndex: activeExpedition.rewardIndex,
		success
	};
}

/**
 * Reset expedition streak mission progress if the latest expedition failed
 */
async function resetExpeditionStreakMission(player: Player): Promise<void> {
	const missionSlots = await MissionSlots.getOfPlayer(player.id);
	const streakMission = missionSlots.find(slot => slot.missionId === "expeditionStreak");
	if (!streakMission || streakMission.isCompleted()) {
		return;
	}

	streakMission.numberDone = 0;
	await streakMission.save();
}

/**
 * Update expedition-related missions based on outcome
 */
async function updateExpeditionMissions(
	player: Player,
	response: CrowniclesPacket[],
	expeditionData: ExpeditionData,
	expeditionSuccessful: boolean
): Promise<void> {
	if (!expeditionSuccessful) {
		await resetExpeditionStreakMission(player);
		return;
	}

	await MissionsController.update(player, response, { missionId: "doExpeditions" });
	await MissionsController.update(player, response, {
		missionId: "longExpedition",
		params: { durationMinutes: expeditionData.durationMinutes }
	});
	await MissionsController.update(player, response, {
		missionId: "dangerousExpedition",
		params: { riskRate: expeditionData.riskRate }
	});
	await MissionsController.update(player, response, { missionId: "expeditionStreak" });
}

/**
 * Check and award expert expediteur badge if conditions are met
 */
async function checkAndAwardExpeditionBadge(
	player: Player,
	expeditionSuccessful: boolean
): Promise<string | undefined> {
	if (!expeditionSuccessful || await PlayerBadgesManager.hasBadge(player.id, Badge.EXPERT_EXPEDITEUR)) {
		return undefined;
	}

	const successfulExpeditions = await LogsReadRequests.countSuccessfulExpeditions(player.keycloakId);
	if (successfulExpeditions >= ExpeditionConstants.BADGE.EXPERT_EXPEDITEUR_THRESHOLD) {
		await PlayerBadgesManager.addBadge(player.id, Badge.EXPERT_EXPEDITEUR);
		return Badge.EXPERT_EXPEDITEUR;
	}
	return undefined;
}

/**
 * Finalize expedition: log completion, clean up scheduled notification, and mark as completed
 */
async function finalizeExpedition(
	player: Player,
	petEntity: PetEntity,
	activeExpedition: PetExpedition,
	expeditionData: ExpeditionData,
	expeditionSuccess: boolean,
	outcome: {
		rewards?: object;
		loveChange?: number;
	}
): Promise<void> {
	await ScheduledExpeditionNotifications.deleteByExpeditionId(activeExpedition.id);
	await PetExpeditions.completeExpedition(activeExpedition);

	crowniclesInstance.logsDatabase.logExpeditionComplete({
		keycloakId: player.keycloakId,
		petGameId: petEntity.id,
		params: extractExpeditionLogParams(expeditionData, activeExpedition, expeditionSuccess),
		rewards: outcome.rewards ?? null,
		loveChange: outcome.loveChange ?? 0
	}).then();
}

/**
 * Apply outcome effects: love change and rewards
 */
async function applyOutcomeEffects(
	outcome: ReturnType<typeof determineExpeditionOutcome>,
	player: Player,
	petEntity: PetEntity,
	response: CrowniclesPacket[],
	context: PacketContext,
	playerActiveObjects: PlayerActiveObjects
): Promise<void> {
	if (outcome.loveChange) {
		await petEntity.changeLovePoints({
			player,
			amount: outcome.loveChange,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
	}
	await petEntity.save();

	if (outcome.rewards) {
		await applyExpeditionRewards(outcome.rewards, player, response, context, playerActiveObjects);
	}
	await player.save();
}

/**
 * Calculate risk and determine expedition outcome
 */
async function calculateOutcome(
	petEntity: PetEntity,
	activeExpedition: PetExpedition,
	expeditionData: ExpeditionData,
	player: Player
): Promise<ReturnType<typeof determineExpeditionOutcome>> {
	const petModel = PetDataController.instance.getById(petEntity.typeId)!;
	const talismans = await PlayerTalismansManager.getOfPlayer(player.id);
	const foodRequired = ExpeditionConstants.FOOD_CONSUMPTION[activeExpedition.rewardIndex];

	const effectiveRisk = calculateEffectiveRisk({
		expedition: expeditionData,
		petModel,
		petTypeId: petEntity.typeId,
		petLovePoints: petEntity.lovePoints,
		foodConsumed: activeExpedition.foodConsumed,
		foodRequired
	});

	return determineExpeditionOutcome({
		effectiveRisk,
		expedition: expeditionData,
		rewardIndex: activeExpedition.rewardIndex,
		hasCloneTalisman: talismans.hasCloneTalisman,
		playerCurrentTokens: player.tokens,
		petTypeId: petEntity.typeId
	});
}

/**
 * Check basic requirements (talisman and pet)
 */
async function checkBasicRequirements(player: Player, hasTalisman: boolean): Promise<CommandPetExpeditionPacketRes | null> {
	if (!hasTalisman) {
		return buildCannotStartResponse(ExpeditionConstants.ERROR_CODES.NO_TALISMAN, false);
	}

	if (!player.petId) {
		return buildCannotStartResponse(ExpeditionConstants.ERROR_CODES.NO_PET, true);
	}

	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		return buildCannotStartResponse(ExpeditionConstants.ERROR_CODES.NO_PET, true);
	}

	return null;
}

/**
 * Check requirements to start a new expedition
 */
function checkStartRequirements(
	player: Player,
	petEntity: PetEntity,
	petModel: NonNullable<ReturnType<typeof PetDataController.instance.getById>>
): CommandPetExpeditionPacketRes | null {
	if (petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
		return buildCannotStartResponse(ExpeditionConstants.ERROR_CODES.INSUFFICIENT_LOVE, true, petEntity);
	}

	if (petEntity.getFeedCooldown(petModel) <= 0) {
		return buildCannotStartResponse(ExpeditionConstants.ERROR_CODES.PET_HUNGRY, true, petEntity);
	}

	if (!Maps.isOnContinent(player)) {
		return buildCannotStartResponse(ExpeditionConstants.ERROR_CODES.NOT_ON_CONTINENT, true, petEntity);
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
		// Get player talismans
		const talismans = await PlayerTalismansManager.getOfPlayer(player.id);

		// Check basic requirements
		const basicCheckResult = await checkBasicRequirements(player, talismans.hasTalisman);
		if (basicCheckResult) {
			response.push(basicCheckResult);
			return;
		}

		const petEntity = (await PetEntities.getById(player.petId!))!;
		const petModel = PetDataController.instance.getById(petEntity.typeId)!;

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
		const expeditions = generateThreeExpeditions(player.mapLinkId!, talismans.hasCloneTalisman);

		// Store expeditions in cache for later retrieval
		PendingExpeditionsCache.set(context.keycloakId!, expeditions);

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
		// Cannot recall pet on PVE island (bug #3929) - must be on boat or main continent
		if (Maps.isOnPveIsland(player) && !Maps.isOnBoat(player)) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: ExpeditionConstants.ERROR_CODES.CANNOT_RECALL_ON_ISLAND }));
			return;
		}

		// Validate prerequisites
		const validation = await validateExpeditionPrerequisites(player.id, player.petId);
		if (!validation.success) {
			response.push(makePacket(CommandPetExpeditionErrorPacket, { errorCode: validation.errorCode }));
			return;
		}

		const {
			activeExpedition, petEntity
		} = validation;
		const expeditionData = activeExpedition.toExpeditionData();

		// Calculate risk and determine outcome
		const outcome = await calculateOutcome(petEntity, activeExpedition, expeditionData, player);

		// Get player active objects for experience rewards
		const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);

		// Apply outcome effects (love change and rewards)
		await applyOutcomeEffects(outcome, player, petEntity, response, context, playerActiveObjects);

		// Update displayed money to include blessing multiplier
		if (outcome.rewards) {
			outcome.rewards.money = BlessingManager.getInstance().applyMoneyBlessing(outcome.rewards.money);
		}

		// Finalize expedition (log, cleanup, mark completed)
		const expeditionSuccess = !outcome.totalFailure;
		await finalizeExpedition(player, petEntity, activeExpedition, expeditionData, expeditionSuccess, outcome);

		// Update expedition missions
		await updateExpeditionMissions(player, response, expeditionData, expeditionSuccess);

		// Check for expert expediteur badge
		const badgeEarned = await checkAndAwardExpeditionBadge(player, expeditionSuccess);

		response.push(makePacket(CommandPetExpeditionResolvePacketRes, {
			success: expeditionSuccess,
			...outcome,
			pet: petEntity.getBasicInfo(),
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

// Register the resolve function to avoid circular dependency
setResolveExpeditionFunction(PetExpeditionCommand.doResolveExpedition);
