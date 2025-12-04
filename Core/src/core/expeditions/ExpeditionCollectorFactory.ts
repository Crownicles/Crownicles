import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../database/game/models/Player";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import { PetExpedition } from "../database/game/models/PetExpedition";
import { Pet } from "../../data/Pet";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	CommandPetExpeditionPacketRes,
	ExpeditionData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
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
import { PetBasicInfo } from "../../../../Lib/src/types/PetBasicInfo";
import { calculateTotalAvailableRations } from "./ExpeditionFoodService";
import { calculateRewardIndex } from "./ExpeditionRewardCalculator";
import {
	handleExpeditionSelect,
	handleExpeditionCancel,
	handleExpeditionRecall,
	ExpeditionSelectContext
} from "./ExpeditionActionHandlers";
import { Guilds } from "../database/game/models/Guild";

/**
 * Reaction handler type for expedition collectors
 */
type ExpeditionReactionHandler = (
	reaction: { reaction: { type: string } } | undefined,
	player: Player,
	resp: CrowniclesPacket[]
) => Promise<void>;

/**
 * Guild food information for expedition
 */
export interface GuildFoodInfo {
	hasGuild: boolean;
	guildFoodAmount?: number;
}

/**
 * Common data for expedition collector creation
 */
export interface ExpeditionCollectorData {
	petEntity: PetEntity;
	activeExpedition: PetExpedition;
	context: PacketContext;
}

/**
 * Common expedition data extracted from active expedition for collectors
 */
interface ExpeditionCollectorCommonData {
	mapLocationId: number;
	locationType: ExpeditionLocationType;
	riskRate: number;
	foodConsumed: number;
	isDistantExpedition: boolean;
}

/**
 * Parameters for creating expedition choice collector
 */
export interface ExpeditionChoiceParams {
	petEntity: PetEntity;
	expeditions: ExpeditionData[];
	guildInfo: GuildFoodInfo;
	context: PacketContext;
}

/**
 * Reference to the resolve expedition function (set by PetExpeditionCommand to avoid circular dependency)
 */
let resolveExpeditionFn: (
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext
) => Promise<void>;

/**
 * Set the resolve expedition function reference
 */
export function setResolveExpeditionFunction(fn: typeof resolveExpeditionFn): void {
	resolveExpeditionFn = fn;
}

/**
 * Extract common pet info for collectors
 */
function extractPetCollectorInfo(petEntity: PetEntity): { pet: PetBasicInfo } {
	return {
		pet: petEntity.getBasicInfo()
	};
}

/**
 * Extract common expedition data from active expedition for collectors
 */
function extractExpeditionCollectorData(activeExpedition: PetExpedition): ExpeditionCollectorCommonData {
	return {
		mapLocationId: activeExpedition.mapLocationId,
		locationType: activeExpedition.locationType as ExpeditionLocationType,
		riskRate: activeExpedition.riskRate,
		foodConsumed: activeExpedition.foodConsumed,
		isDistantExpedition: activeExpedition.isDistantExpedition
	};
}

/**
 * Convert ExpeditionData to ExpeditionOptionData for collector
 */
function convertToExpeditionOptionData(expeditions: ExpeditionData[]): ExpeditionOptionData[] {
	return expeditions.map(exp => ({
		...exp,
		mapLocationId: exp.mapLocationId!,
		foodCost: exp.foodCost ?? ExpeditionConstants.DEFAULT_FOOD_COST,
		rewardIndex: calculateRewardIndex(exp)
	}));
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
 * Create common end callback logic for expedition collectors
 */
function createExpeditionEndCallback(
	context: PacketContext,
	reactionHandler: ExpeditionReactionHandler
): EndCallback {
	return async (collectorInstance: ReactionCollectorInstance, resp: CrowniclesPacket[]): Promise<void> => {
		const reaction = collectorInstance.getFirstReaction();
		BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION);

		const reloadedPlayer = await Players.getByKeycloakId(context.keycloakId);
		if (!reloadedPlayer) {
			return;
		}

		await reactionHandler(reaction, reloadedPlayer, resp);
	};
}

/**
 * Create the finished expedition collector with claim option
 */
export function createFinishedExpeditionCollector(data: ExpeditionCollectorData): CrowniclesPacket {
	const {
		petEntity, activeExpedition, context
	} = data;

	const collector = new ReactionCollectorPetExpeditionFinished({
		...extractPetCollectorInfo(petEntity),
		...extractExpeditionCollectorData(activeExpedition)
	});

	const endCallback = createExpeditionEndCallback(context, async (reaction, player, resp) => {
		if (reaction?.reaction.type === ReactionCollectorPetExpeditionClaimReaction.name) {
			await resolveExpeditionFn(resp, player, context);
		}
	});

	return buildExpeditionCollector(collector, context, endCallback);
}

/**
 * Create the in-progress expedition collector with recall option
 */
export function createInProgressExpeditionCollector(data: ExpeditionCollectorData): CrowniclesPacket {
	const {
		petEntity, activeExpedition, context
	} = data;

	const collector = new ReactionCollectorPetExpedition({
		...extractPetCollectorInfo(petEntity),
		returnTime: activeExpedition.endDate.getTime(),
		foodConsumedDetails: undefined,
		...extractExpeditionCollectorData(activeExpedition)
	});

	const endCallback = createExpeditionEndCallback(context, async (reaction, player, resp) => {
		if (reaction?.reaction.type === ReactionCollectorPetExpeditionRecallReaction.name) {
			await handleExpeditionRecall(player, resp);
		}
	});

	return buildExpeditionCollector(collector, context, endCallback);
}

/**
 * Create the expedition choice collector
 */
export function createExpeditionChoiceCollector(params: ExpeditionChoiceParams): CrowniclesPacket {
	const {
		petEntity, expeditions, guildInfo, context
	} = params;

	const collector = new ReactionCollectorPetExpeditionChoice({
		...extractPetCollectorInfo(petEntity),
		expeditions: convertToExpeditionOptionData(expeditions),
		hasGuild: guildInfo.hasGuild,
		guildFoodAmount: guildInfo.guildFoodAmount
	});

	const endCallback: EndCallback = async (collectorInstance: ReactionCollectorInstance, resp: CrowniclesPacket[]): Promise<void> => {
		const reaction = collectorInstance.getFirstReaction();
		BlockingUtils.unblockPlayer(context.keycloakId, BlockingConstants.REASONS.PET_EXPEDITION_CHOICE);

		const reloadedPlayer = await Players.getByKeycloakId(context.keycloakId);
		if (!reloadedPlayer) {
			return;
		}

		const reloadedPetEntity = reloadedPlayer.petId ? await PetEntities.getById(reloadedPlayer.petId) : null;

		if (reaction?.reaction.type === ReactionCollectorPetExpeditionSelectReaction.name) {
			const selectReaction = reaction.reaction.data as ReactionCollectorPetExpeditionSelectReaction;
			if (reloadedPetEntity) {
				const selectContext: ExpeditionSelectContext = {
					player: reloadedPlayer,
					petEntity: reloadedPetEntity,
					expeditionId: selectReaction.expedition.id,
					keycloakId: context.keycloakId
				};
				await handleExpeditionSelect(selectContext, resp);
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
 * Get guild food amount for a player's pet
 */
export async function getGuildFoodInfo(player: Player, petModel: Pet): Promise<GuildFoodInfo> {
	if (!player.guildId) {
		return { hasGuild: false };
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return { hasGuild: false };
	}

	return {
		hasGuild: true,
		guildFoodAmount: calculateTotalAvailableRations(guild, petModel)
	};
}

/**
 * Build a "cannot start expedition" response packet
 */
export function buildCannotStartResponse(
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
		pet: petEntity?.getBasicInfo()
	});
}

/**
 * Handle active expedition - show finished or in-progress collector
 */
export function handleActiveExpedition(
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
