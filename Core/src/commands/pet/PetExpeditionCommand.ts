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
 * Check and award expert expediteur badge if conditions are met
 */
async function checkAndAwardExpeditionBadge(
	player: Player,
	expeditionSuccessful: boolean
): Promise<string | undefined> {
	if (!expeditionSuccessful || player.hasBadge(Badge.EXPERT_EXPEDITEUR)) {
		return undefined;
	}

	const successfulExpeditions = await LogsReadRequests.countSuccessfulExpeditions(player.keycloakId);
	if (successfulExpeditions >= ExpeditionConstants.BADGE.EXPERT_EXPEDITEUR_THRESHOLD) {
		player.addBadge(Badge.EXPERT_EXPEDITEUR);
		await player.save();
		return Badge.EXPERT_EXPEDITEUR;
	}
	return undefined;
}

/**
 * Check basic requirements (talisman and pet)
 */
async function checkBasicRequirements(player: Player): Promise<CommandPetExpeditionPacketRes | null> {
	if (!player.hasTalisman) {
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
	petModel: ReturnType<typeof PetDataController.instance.getById>
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

		// Get the required food from the stored reward index
		const foodRequired = ExpeditionConstants.FOOD_CONSUMPTION[activeExpedition.rewardIndex];

		// Calculate effective risk with food penalty if insufficient food was consumed
		const effectiveRisk = calculateEffectiveRisk({
			expedition: expeditionData,
			petModel,
			petLovePoints: petEntity.lovePoints,
			foodConsumed: activeExpedition.foodConsumed,
			foodRequired
		});
		const outcome = determineExpeditionOutcome(effectiveRisk, expeditionData, activeExpedition.rewardIndex, player.hasCloneTalisman);

		// Apply love change
		if (outcome.loveChange) {
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

		// Mark expedition as completed and remove scheduled notification
		await ScheduledExpeditionNotifications.deleteByExpeditionId(activeExpedition.id);
		await PetExpeditions.completeExpedition(activeExpedition);

		// Log expedition completion to database (include stored reward index)
		const expeditionSuccess = !outcome.totalFailure;
		crowniclesInstance.logsDatabase.logExpeditionComplete(
			player.keycloakId,
			petEntity.id,
			extractExpeditionLogParams(expeditionData, activeExpedition, expeditionSuccess),
			outcome.rewards,
			outcome.loveChange
		).then();

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
