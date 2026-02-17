import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import {
	Pet, PetDataController
} from "../../data/Pet";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { giveRandomItem } from "../utils/ItemUtils";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import { SmallEventPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventPetPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../database/game/models/Player";
import {
	PetConstants, PetInteraction
} from "../../../../Lib/src/constants/PetConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { LogsDatabase } from "../database/logs/LogsDatabase";
import { ErrorPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";
import { MissionsController } from "../missions/MissionsController";
import { giveFoodToGuild } from "../utils/FoodUtils";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { PetFood } from "../../../../Lib/src/types/PetFood";
import { Badge } from "../../../../Lib/src/types/Badge";
import { BlessingManager } from "../blessings/BlessingManager";
import { PetUtils } from "../utils/PetUtils";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";

/**
 * Context object passed to interaction handlers
 */
interface InteractionContext {
	packet: SmallEventPetPacket;
	response: CrowniclesPacket[];
	context: PacketContext;
	player: Player;
	petEntity: PetEntity;
	playerActiveObjects: PlayerActiveObjects;
}

/**
 * Configuration for a pet interaction handler
 */
interface PetInteractionConfig {

	/**
	 * Condition that must be true for the interaction to proceed.
	 * If false, interaction becomes NOTHING.
	 */
	canExecute?: (ctx: InteractionContext) => boolean | Promise<boolean>;

	/**
	 * Range for random amount generation (if applicable)
	 */
	range?: {
		MIN: number; MAX: number;
	};

	/**
	 * Whether the amount should be negated (for LOSE_ interactions)
	 */
	negateAmount?: boolean;

	/**
	 * The action to execute for this interaction
	 */
	execute: (ctx: InteractionContext, amount?: number) => Promise<void> | void;
}

/**
 * Factory for stat-change interactions (win/lose health, money, score, love).
 * Extracts the common pattern: set packet.amount, apply stat change, optional post-processing.
 */
function createStatInteraction(config: {
	range: {
		MIN: number; MAX: number;
	};
	negateAmount?: boolean;
	canExecute?: PetInteractionConfig["canExecute"];
	apply: (ctx: InteractionContext, amount: number) => Promise<unknown>;
	afterApply?: (ctx: InteractionContext) => unknown | Promise<unknown>;
}): PetInteractionConfig {
	return {
		range: config.range,
		negateAmount: config.negateAmount,
		canExecute: config.canExecute,
		execute: async (ctx, amount): Promise<void> => {
			ctx.packet.amount = config.negateAmount ? Math.abs(amount!) : amount;
			await config.apply(ctx, amount!);
			if (config.afterApply) {
				await config.afterApply(ctx);
			}
		}
	};
}

/**
 * Registry of all pet interaction handlers
 */
const INTERACTION_HANDLERS: Record<string, PetInteractionConfig> = {
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_ENERGY]: {
		canExecute: ({ player }) => player.fightPointsLost > 0,
		range: SmallEventConstants.PET.ENERGY,
		execute: ({
			packet, player, playerActiveObjects
		}, amount) => {
			packet.amount = amount;
			player.addEnergy(amount!, NumberChangeReason.SMALL_EVENT, playerActiveObjects);
		}
	},
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_FOOD]: {
		canExecute: ({ player }) => player.guildId !== null,
		execute: async ({
			packet, response, player
		}) => {
			packet.food = RandomUtils.crowniclesRandom.pick(Object.values(PetConstants.PET_FOOD)) as PetFood;
			await giveFoodToGuild(response, player, packet.food, 1, NumberChangeReason.SMALL_EVENT);
		}
	},
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_POINTS]: createStatInteraction({
		range: SmallEventConstants.PET.POINTS,
		apply: ({
			response, player
		}, amount) => player.addScore({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		})
	}),
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_LOVE]: createStatInteraction({
		range: SmallEventConstants.PET.LOVE_POINTS,
		canExecute: ({ petEntity }) => petEntity.getLoveLevelNumber() !== PetConstants.LOVE_LEVEL.TRAINED,
		apply: ({
			response, player, petEntity
		}, amount) => petEntity.changeLovePoints({
			player, amount, response, reason: NumberChangeReason.SMALL_EVENT
		})
	}),
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_MONEY]: createStatInteraction({
		range: SmallEventConstants.PET.MONEY,
		apply: ({
			response, player
		}, amount) => player.addMoney({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		}),
		afterApply: ({ packet }) => {
			packet.amount = BlessingManager.getInstance().applyMoneyBlessing(packet.amount!);
		}
	}),
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_TIME]: {
		range: SmallEventConstants.PET.TIME,
		execute: async ({
			packet, player
		}, amount) => {
			packet.amount = amount;
			await TravelTime.timeTravel(player, amount!, NumberChangeReason.SMALL_EVENT);
		}
	},
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_HEALTH]: createStatInteraction({
		range: SmallEventConstants.PET.HEALTH,
		canExecute: ({
			player, playerActiveObjects
		}) => player.getHealthValue() < player.getMaxHealth(playerActiveObjects),
		apply: ({
			response, player
		}, amount) => player.addHealth({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		}),
		afterApply: ({
			player, response
		}) => MissionsController.update(player, response, { missionId: "petEarnHealth" })
	}),
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_ITEM]: {
		execute: async ({
			response, context, player
		}) => {
			await giveRandomItem(context, response, player);
		}
	},
	[PetConstants.PET_INTERACTIONS_NAMES.WIN_BADGE]: {
		canExecute: async ({ player }) => !await PlayerBadgesManager.hasBadge(player.id, Badge.LEGENDARY_PET),
		execute: async ({ player }) => {
			await PlayerBadgesManager.addBadge(player.id, Badge.LEGENDARY_PET);
		}
	},
	[PetConstants.PET_INTERACTIONS_NAMES.LOSE_HEALTH]: createStatInteraction({
		range: SmallEventConstants.PET.HEALTH,
		negateAmount: true,
		apply: ({
			response, player
		}, amount) => player.addHealth({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		})
	}),
	[PetConstants.PET_INTERACTIONS_NAMES.LOSE_MONEY]: createStatInteraction({
		range: SmallEventConstants.PET.MONEY,
		negateAmount: true,
		apply: ({
			response, player
		}, amount) => player.addMoney({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		})
	}),
	[PetConstants.PET_INTERACTIONS_NAMES.LOSE_TIME]: {
		range: SmallEventConstants.PET.TIME,
		execute: async ({
			packet, player
		}, amount) => {
			packet.amount = amount;
			await TravelTime.applyEffect(player, Effect.OCCUPIED, amount!, new Date(), NumberChangeReason.SMALL_EVENT);
		}
	},
	[PetConstants.PET_INTERACTIONS_NAMES.LOSE_LOVE]: createStatInteraction({
		range: SmallEventConstants.PET.LOVE_POINTS,
		negateAmount: true,
		apply: ({
			response, player, petEntity
		}, amount) => petEntity.changeLovePoints({
			player, amount, response, reason: NumberChangeReason.SMALL_EVENT
		})
	}),
	[PetConstants.PET_INTERACTIONS_NAMES.PET_FLEE]: {
		execute: async ({
			player, petEntity, response
		}) => {
			LogsDatabase.logPetFree(petEntity).then();
			await petEntity.destroy();
			player.petId = null;
			await MissionsController.update(player, response, { missionId: "depositPetInShelter" });
		}
	}
};

/**
 * Return all possibilities the player can get on this small event.
 * @param petEntity
 * @param pet
 */
function generatePossibleIssues(petEntity: PetEntity, pet: Pet): PetInteraction[] {
	if (petEntity.isFeisty()) {
		return Object.values(PetConstants.PET_INTERACTIONS.PET_FEISTY);
	}
	const petVigor = PetUtils.getPetVigor(pet, petEntity.lovePoints);
	const interactions: PetInteraction[] = [];
	const unlockedTiers = Math.max(
		PetConstants.MIN_UNLOCKED_INTERACTION_TIER,
		Math.min(petVigor, PetConstants.PET_INTERACTIONS.PET_NORMAL.length - 1)
	);
	for (let i = PetConstants.MIN_UNLOCKED_INTERACTION_TIER; i <= unlockedTiers; i++) {
		interactions.push(...Object.values(PetConstants.PET_INTERACTIONS.PET_NORMAL[i]));
	}
	return interactions;
}

/**
 * Choose an interaction at random.
 * @param possibleIssues
 */
function pickRandomInteraction(possibleIssues: PetInteraction[]): string {
	if (possibleIssues.length === 0) {
		return Constants.DEFAULT_ERROR;
	}
	const totalWeight = possibleIssues.map((pi: PetInteraction): number => pi.probabilityWeight)
		.reduce((a: number, b: number): number => a + b, 0);
	if (totalWeight === 0) {
		return Constants.DEFAULT_ERROR;
	}
	const randomNb = RandomUtils.randInt(1, totalWeight + 1);
	let sum = 0;
	for (const petInteraction of possibleIssues) {
		sum += petInteraction.probabilityWeight;
		if (sum >= randomNb) {
			return petInteraction.name;
		}
	}
	return Constants.DEFAULT_ERROR;
}

/**
 * Manage the output for the player according to the interaction.
 * Uses a data-driven approach with the INTERACTION_HANDLERS registry.
 * @param packet
 * @param response
 * @param context
 * @param player
 * @param petEntity
 */
async function managePickedInteraction(packet: SmallEventPetPacket, response: CrowniclesPacket[], context: PacketContext, player: Player, petEntity: PetEntity): Promise<void> {
	const handler = INTERACTION_HANDLERS[packet.interactionName];
	if (!handler) {
		// Unknown interaction or NOTHING - do nothing
		return;
	}

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	const ctx: InteractionContext = {
		packet, response, context, player, petEntity, playerActiveObjects
	};

	// Check if the interaction can be executed
	const canProceed = await checkInteractionCanExecute(handler, ctx, packet);
	if (!canProceed) {
		return;
	}

	// Generate and apply amount
	const amount = generateInteractionAmount(handler);
	await handler.execute(ctx, amount);
}

/**
 * Check if the interaction can be executed based on handler's canExecute condition
 */
async function checkInteractionCanExecute(
	handler: PetInteractionConfig,
	ctx: InteractionContext,
	packet: SmallEventPetPacket
): Promise<boolean> {
	if (!handler.canExecute) {
		return true;
	}
	const canExecute = await handler.canExecute(ctx);
	if (!canExecute) {
		packet.interactionName = PetConstants.PET_INTERACTIONS_NAMES.NOTHING;
		return false;
	}
	return true;
}

/**
 * Generate random amount for the interaction based on handler's range configuration
 */
function generateInteractionAmount(handler: PetInteractionConfig): number | undefined {
	if (!handler.range) {
		return undefined;
	}
	const amount = RandomUtils.rangedInt(handler.range);
	return handler.negateAmount ? -amount : amount;
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async player => Maps.isOnContinent(player) && await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT),
	executeSmallEvent: async (response, player, context): Promise<void> => {
		const petEntity = await PetEntities.getById(player.petId);
		if (!petEntity) {
			response.push(makePacket(ErrorPacket, { message: "SmallEvent Pet : pet entity not found" }));
			return;
		}
		const pet = PetDataController.instance.getById(petEntity.typeId)!;
		const possibleIssues = generatePossibleIssues(petEntity, pet);
		const randomPet = PetEntities.generateRandomPetEntityNotGuild();
		const packet: SmallEventPetPacket = {
			interactionName: pickRandomInteraction(possibleIssues),
			petTypeId: petEntity.typeId,
			petSex: petEntity.sex as SexTypeShort,
			petNickname: petEntity.nickname,
			randomPetTypeId: randomPet.typeId,
			randomPetSex: randomPet.sex as SexTypeShort
		};
		if (packet.interactionName === Constants.DEFAULT_ERROR) {
			response.push(makePacket(ErrorPacket, { message: "SmallEvent Pet : cannot determine an interaction for the user" }));
			return;
		}
		await managePickedInteraction(packet, response, context, player, petEntity);
		response.unshift(makePacket(SmallEventPetPacket, packet));
	}
};
