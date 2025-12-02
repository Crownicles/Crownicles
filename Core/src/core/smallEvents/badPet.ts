import { SmallEventFuncs } from "../../data/SmallEvent";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { BlockingUtils } from "../utils/BlockingUtils";
import { StringConstants } from "../../../../Lib/src/constants/StringConstants";
import {
	ReactionCollectorBadPetReaction,
	ReactionCollectorBadPetSmallEvent
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { SmallEventBadPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBadPetPacket";
import {
	makePacket, CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetEntity } from "../database/game/models/PetEntity";
import {
	Pet, PetDataController
} from "../../data/Pet";
import Player from "../database/game/models/Player";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { Maps } from "../maps/Maps";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { PetUtils } from "../utils/PetUtils";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { Guilds } from "../database/game/models/Guild";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";

/**
 * Result of a bad pet action handler
 */
type BadPetActionResult = {
	loveLost: number;
	interactionType: string;
};

/**
 * Handler function signature for bad pet actions
 */
type BadPetActionHandler = (petEntity: PetEntity, petModel: Pet, player: Player) => Promise<BadPetActionResult>;

/**
 * Structure defining a bad pet action
 */
interface BadPetAction {
	id: string;
	handler: BadPetActionHandler;
}

/**
 * Food type configuration for give food actions
 */
type FoodType = "meat" | "veg";


/**
 * Calculate love lost based on success chance - common pattern for many actions
 * @param successChance - Probability of success (0-1)
 * @param failMinLoveLost - Minimum love lost on failure
 * @param failMaxLoveLost - Maximum love lost on failure
 * @returns Love lost (0 if success, random value in range if failure)
 */
function calculateLoveLostFromSuccessChance(successChance: number, failMinLoveLost: number, failMaxLoveLost: number): number {
	const success = RandomUtils.crowniclesRandom.bool(successChance);
	return success ? 0 : RandomUtils.randInt(failMinLoveLost, failMaxLoveLost);
}

/**
 * Check if pet's force meets the "strong" threshold
 */
function isPetStrong(petModel: Pet): boolean {
	return petModel.force >= SmallEventConstants.BAD_PET.THRESHOLDS.PET_FORCE_STRONG;
}

/**
 * Get pet entity data for packets
 */
async function getPetData(petId: number | null): Promise<{
	petEntity: PetEntity | null;
	petId: number;
	sex: string;
	petNickname: string | undefined;
}> {
	const petEntity = petId ? await PetEntity.findByPk(petId) : null;
	return {
		petEntity,
		petId: petEntity?.typeId ?? 0,
		sex: petEntity?.sex ?? StringConstants.SEX.MALE.short,
		petNickname: petEntity?.nickname ?? undefined
	};
}

/**
 * Apply love loss using the canonical PetEntity.changeLovePoints helper.
 * This ensures logging and mission updates are executed consistently.
 */
async function applyLoveLoss(petEntity: PetEntity | null, loveLost: number, player: Player, response: CrowniclesPacket[]): Promise<void> {
	if (loveLost <= 0 || !petEntity) {
		return;
	}

	// changeLovePoints expects a PlayerEditValueParameters object - pass a negative amount to decrease love
	await petEntity.changeLovePoints({
		player,
		amount: -Math.abs(loveLost),
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});
	await petEntity.save();
}

/*
 * ============================================================================
 * ACTION HANDLERS
 * ============================================================================
 */

/**
 * Handle intimidate action - effectiveness based on pet's force
 */
function handleIntimidate(_petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const { LOVE_LOST } = SmallEventConstants.BAD_PET;

	const loveLost = isPetStrong(petModel)
		? RandomUtils.randInt(LOVE_LOST.INTIMIDATE.STRONG_MIN, LOVE_LOST.INTIMIDATE.STRONG_MAX)
		: RandomUtils.randInt(LOVE_LOST.INTIMIDATE.WEAK_MIN, LOVE_LOST.INTIMIDATE.WEAK_MAX);

	return Promise.resolve({
		loveLost, interactionType: "intimidate"
	});
}

/**
 * Handle plead action - effectiveness inverse to pet's force
 */
function handlePlead(_petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const { LOVE_LOST } = SmallEventConstants.BAD_PET;

	const loveLost = isPetStrong(petModel)
		? RandomUtils.randInt(LOVE_LOST.PLEAD.STRONG_MIN, LOVE_LOST.PLEAD.STRONG_MAX)
		: RandomUtils.randInt(LOVE_LOST.PLEAD.WEAK_MIN, LOVE_LOST.PLEAD.WEAK_MAX);

	return Promise.resolve({
		loveLost, interactionType: "plead"
	});
}

/**
 * Handle giving food to pet - generic handler for both meat and vegetables
 * @param foodType - Type of food to give (meat or veg)
 * @param petModel - Pet model to check diet compatibility
 * @param player - Player giving the food
 */
async function handleGiveFood(foodType: FoodType, petModel: Pet, player: Player): Promise<BadPetActionResult> {
	const { LOVE_LOST } = SmallEventConstants.BAD_PET;
	const foodConfig = foodType === "meat"
		? {
			canEat: petModel.canEatMeat(), foodKey: "carnivorousFood" as const, prefix: "giveMeat"
		}
		: {
			canEat: petModel.canEatVegetables(), foodKey: "herbivorousFood" as const, prefix: "giveVeg"
		};

	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;

	if (!guild || guild[foodConfig.foodKey] <= 0) {
		return {
			loveLost: LOVE_LOST.GIVE_FOOD.NO_FOOD,
			interactionType: `${foodConfig.prefix}NoFood`
		};
	}

	// Decrement the food stock
	guild[foodConfig.foodKey] -= 1;
	await guild.save();

	if (foodConfig.canEat) {
		return {
			loveLost: RandomUtils.randInt(LOVE_LOST.GIVE_FOOD.JEALOUS_MIN, LOVE_LOST.GIVE_FOOD.JEALOUS_MAX),
			interactionType: `${foodConfig.prefix}Likes`
		};
	}

	const dislikesLoveLost = RandomUtils.crowniclesRandom.bool(LOVE_LOST.GIVE_FOOD.DISLIKES_CHANCE)
		? LOVE_LOST.GIVE_FOOD.DISLIKES_AMOUNT
		: 0;

	return {
		loveLost: dislikesLoveLost,
		interactionType: `${foodConfig.prefix}Dislikes`
	};
}

/**
 * Handle give meat action - depends on guild inventory and pet's diet
 */
function handleGiveMeat(_petEntity: PetEntity, petModel: Pet, player: Player): Promise<BadPetActionResult> {
	return handleGiveFood("meat", petModel, player);
}

/**
 * Handle give vegetables action - depends on guild inventory and pet's diet
 */
function handleGiveVeg(_petEntity: PetEntity, petModel: Pet, player: Player): Promise<BadPetActionResult> {
	return handleGiveFood("veg", petModel, player);
}

/**
 * Handle flee action - success chance based on player's speed
 */
async function handleFlee(_petEntity: PetEntity, _petModel: Pet, player: Player): Promise<BadPetActionResult> {
	const {
		THRESHOLDS, LOVE_LOST
	} = SmallEventConstants.BAD_PET;

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	const playerSpeed = player.getCumulativeSpeed(playerActiveObjects);

	const successChance = playerSpeed > THRESHOLDS.PLAYER_SPEED_FAST ? THRESHOLDS.FLEE_SUCCESS_CHANCE_FAST : 0;

	return {
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.FLEE.MIN, LOVE_LOST.FLEE.MAX),
		interactionType: "flee"
	};
}

/**
 * Handle hide action - success chance based on pet's force (weak pets hide better)
 */
function handleHide(_petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const {
		THRESHOLDS, LOVE_LOST
	} = SmallEventConstants.BAD_PET;

	const successChance = petModel.force < THRESHOLDS.PET_FORCE_WEAK ? THRESHOLDS.HIDE_SUCCESS_CHANCE_WEAK : 0;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.HIDE.MIN, LOVE_LOST.HIDE.MAX),
		interactionType: "hide"
	});
}

/**
 * Handle wait action - fixed love loss
 */
function handleWait(_petEntity: PetEntity, _petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	return Promise.resolve({
		loveLost: SmallEventConstants.BAD_PET.LOVE_LOST.WAIT,
		interactionType: "wait"
	});
}

/**
 * Handle protect action - success chance scales linearly with player's defense
 */
async function handleProtect(_petEntity: PetEntity, _petModel: Pet, player: Player): Promise<BadPetActionResult> {
	const {
		THRESHOLDS, LOVE_LOST
	} = SmallEventConstants.BAD_PET;

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	const playerDefense = player.getCumulativeDefense(playerActiveObjects);

	const defenseRatio = Math.min(playerDefense / THRESHOLDS.PLAYER_DEFENSE_MAX, 1);
	const successChance = defenseRatio * THRESHOLDS.PROTECT_MAX_SUCCESS_CHANCE;

	return {
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.PROTECT.FAIL_MIN, LOVE_LOST.PROTECT.FAIL_MAX),
		interactionType: "protect"
	};
}

/**
 * Handle distract action - fixed success chance
 */
function handleDistract(_petEntity: PetEntity, _petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const {
		THRESHOLDS, LOVE_LOST
	} = SmallEventConstants.BAD_PET;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(
			THRESHOLDS.DISTRACT_SUCCESS_CHANCE,
			LOVE_LOST.DISTRACT.FAIL_MIN,
			LOVE_LOST.DISTRACT.FAIL_MAX
		),
		interactionType: "distract"
	});
}

/**
 * Handle calm action - success chance based on pet's current love
 */
function handleCalm(petEntity: PetEntity, _petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const { LOVE_LOST } = SmallEventConstants.BAD_PET;
	const loveRatio = petEntity.lovePoints / PetConstants.MAX_LOVE_POINTS;
	const successChance = LOVE_LOST.CALM.BASE_SUCCESS_CHANCE + loveRatio * LOVE_LOST.CALM.LOVE_BONUS_MULTIPLIER;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.CALM.FAIL_MIN, LOVE_LOST.CALM.FAIL_MAX),
		interactionType: "calm"
	});
}

/**
 * Handle imposer action - success chance based on pet's rarity
 */
function handleImposer(_petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const { LOVE_LOST } = SmallEventConstants.BAD_PET;
	const successChance = LOVE_LOST.IMPOSER.BASE_SUCCESS_CHANCE + (petModel.rarity - 1) * LOVE_LOST.IMPOSER.RARITY_BONUS;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.IMPOSER.FAIL_MIN, LOVE_LOST.IMPOSER.FAIL_MAX),
		interactionType: "imposer"
	});
}

/**
 * Handle energize action - success chance based on pet's vigor
 */
function handleEnergize(petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const { LOVE_LOST } = SmallEventConstants.BAD_PET;
	const vigor = PetUtils.getPetVigor(petModel, petEntity.lovePoints);
	const successChance = LOVE_LOST.ENERGIZE.BASE_SUCCESS_CHANCE + vigor / PetConstants.VIGOR.MAX * LOVE_LOST.ENERGIZE.VIGOR_BONUS_MULTIPLIER;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.ENERGIZE.FAIL_MIN, LOVE_LOST.ENERGIZE.FAIL_MAX),
		interactionType: "energize"
	});
}

/**
 * All available bad pet actions with their handlers
 */
const BAD_PET_ACTIONS: BadPetAction[] = [
	{
		id: "intimidate", handler: handleIntimidate
	},
	{
		id: "plead", handler: handlePlead
	},
	{
		id: "giveMeat", handler: handleGiveMeat
	},
	{
		id: "giveVeg", handler: handleGiveVeg
	},
	{
		id: "flee", handler: handleFlee
	},
	{
		id: "hide", handler: handleHide
	},
	{
		id: "wait", handler: handleWait
	},
	{
		id: "protect", handler: handleProtect
	},
	{
		id: "distract", handler: handleDistract
	},
	{
		id: "calm", handler: handleCalm
	},
	{
		id: "imposer", handler: handleImposer
	},
	{
		id: "energize", handler: handleEnergize
	}
];

/**
 * Map of action handlers indexed by action id for quick lookup
 */
const REACTION_HANDLERS: Record<string, BadPetActionHandler> = Object.fromEntries(
	BAD_PET_ACTIONS.map(action => [action.id, action.handler])
);

/**
 * Pick random actions from the available pool
 */
function pickRandomActions(count: number): BadPetAction[] {
	const shuffled = [...BAD_PET_ACTIONS];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = RandomUtils.randInt(0, i + 1);
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled.slice(0, count);
}

/**
 * Extended result that includes the pet entity for reuse
 */
type BadPetActionResultWithEntity = BadPetActionResult & {
	petEntity: PetEntity | null;
};

/**
 * Execute the action handler based on the player's reaction.
 * If no reaction is provided (timeout case), defaults to the "wait" action.
 * This is intentional behavior - when the collector expires without player input,
 * the event resolves with the default "wait" outcome rather than being cancelled.
 */
async function executeActionHandler(reactionId: string | undefined, player: Player): Promise<BadPetActionResultWithEntity> {
	const defaultResult: BadPetActionResultWithEntity = {
		loveLost: SmallEventConstants.BAD_PET.LOVE_LOST.WAIT,
		interactionType: "wait",
		petEntity: null
	};

	const petEntity = await PetEntity.findOne({ where: { id: player.petId } });
	if (!petEntity) {
		return defaultResult;
	}

	if (!reactionId) {
		return {
			...defaultResult, petEntity
		};
	}

	const handler = REACTION_HANDLERS[reactionId];
	if (!handler) {
		return {
			...defaultResult, petEntity
		};
	}

	const petModel = PetDataController.instance.getById(petEntity.typeId);
	if (!petModel) {
		return {
			...defaultResult, petEntity
		};
	}

	const result = await handler(petEntity, petModel, player);
	return {
		...result, petEntity
	};
}

/*
 * ============================================================================
 * CALLBACK & SMALL EVENT FUNCTIONS
 * ============================================================================
 */

/**
 * Create the end callback for the reaction collector
 */
function getEndCallback(player: Player): EndCallback {
	return async (collector, response): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.BAD_PET_SMALL_EVENT);

		const reaction = collector.getFirstReaction();
		const reactionId = (reaction?.reaction.data as { id?: string } | undefined)?.id;

		const result = await executeActionHandler(reactionId, player);

		await applyLoveLoss(result.petEntity, result.loveLost, player, response);

		const petData = await getPetData(player.petId);

		response.push(makePacket(SmallEventBadPetPacket, {
			loveLost: result.loveLost,
			interactionType: result.interactionType,
			petId: petData.petId,
			sex: petData.sex,
			petNickname: petData.petNickname
		}));
	};
}

/**
 * Check if the small event can be executed for this player
 */
async function canBeExecuted(player: Player): Promise<boolean> {
	if (!Maps.isOnContinent(player)) {
		return false;
	}

	// Moltiar avoids Mount Celestrum where Talvar resides
	const destination = player.getDestination();
	const origin = player.getPreviousMap();
	if ([destination.id, origin.id].some(mapId => mapId === MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM)) {
		return false;
	}

	// Check if pet is available (handles expedition check with clone talisman logic)
	if (!await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT)) {
		return false;
	}

	const petEntity = await PetEntity.findByPk(player.petId);
	return petEntity !== null && petEntity.lovePoints > 0;
}

/**
 * Execute the bad pet small event
 */
async function executeSmallEvent(response: CrowniclesPacket[], player: Player, context: PacketContext, testArgs?: string[]): Promise<void> {
	let selectedActions: BadPetAction[];

	if (testArgs && testArgs.length > 0) {
		// Use testArgs to select specific actions by ID for testing
		selectedActions = testArgs
			.map(id => BAD_PET_ACTIONS.find(action => action.id === id))
			.filter((action): action is BadPetAction => action !== undefined);

		// Fallback to random if no valid actions found
		if (selectedActions.length === 0) {
			selectedActions = pickRandomActions(SmallEventConstants.BAD_PET.ACTIONS_TO_SHOW);
		}
	}
	else {
		selectedActions = pickRandomActions(SmallEventConstants.BAD_PET.ACTIONS_TO_SHOW);
	}

	// Create reaction instances with their ids directly set
	const reactions = selectedActions.map(action => {
		const reaction = new ReactionCollectorBadPetReaction();
		reaction.id = action.id;
		return reaction;
	});

	const petData = await getPetData(player.petId);

	const collector = new ReactionCollectorBadPetSmallEvent(
		petData.petId,
		petData.sex,
		petData.petNickname,
		reactions
	);

	const packet = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			time: Constants.MESSAGES.COLLECTOR_TIME
		},
		getEndCallback(player)
	)
		.block(player.keycloakId, BlockingConstants.REASONS.BAD_PET_SMALL_EVENT)
		.build();

	response.push(packet);
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted,
	executeSmallEvent
};

