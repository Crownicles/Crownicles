import { SmallEventFuncs } from "../../data/SmallEvent";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { BlockingUtils } from "../utils/BlockingUtils";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import {
	ReactionCollectorBadPetReaction,
	ReactionCollectorBadPetSmallEvent
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { SmallEventBadPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBadPetPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
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
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";

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
 * Guild model food property key (carnivorousFood or herbivorousFood)
 */
type GuildFoodPropertyKey = typeof PetConstants.PET_FOOD.CARNIVOROUS_FOOD | typeof PetConstants.PET_FOOD.HERBIVOROUS_FOOD;


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
 * Pet data result for packets
 */
interface PetData {
	petTypeId: number;
	sex: SexTypeShort;
	nickname?: string;
}

/**
 * Get pet entity data for packets using PetEntities.getById
 * Note: This function assumes canBeExecuted has already validated pet existence
 * @param player - The player whose pet data to retrieve
 * @returns Pet data for the player's pet
 */
async function getPetData(player: Player): Promise<PetData> {
	// canBeExecuted guarantees player.petId exists and pet is valid
	const petEntity = await PetEntities.getById(player.petId);

	return {
		petTypeId: petEntity!.typeId,
		sex: petEntity!.sex as SexTypeShort,
		nickname: petEntity!.nickname ?? undefined
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
	const {
		LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;

	const loveLost = isPetStrong(petModel)
		? RandomUtils.randInt(LOVE_LOST.INTIMIDATE.STRONG_MIN, LOVE_LOST.INTIMIDATE.STRONG_MAX)
		: RandomUtils.randInt(LOVE_LOST.INTIMIDATE.WEAK_MIN, LOVE_LOST.INTIMIDATE.WEAK_MAX);

	return Promise.resolve({
		loveLost, interactionType: ACTION_IDS.INTIMIDATE
	});
}

/**
 * Handle plead action - effectiveness inverse to pet's force
 */
function handlePlead(_petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const {
		LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;

	const loveLost = isPetStrong(petModel)
		? RandomUtils.randInt(LOVE_LOST.PLEAD.STRONG_MIN, LOVE_LOST.PLEAD.STRONG_MAX)
		: RandomUtils.randInt(LOVE_LOST.PLEAD.WEAK_MIN, LOVE_LOST.PLEAD.WEAK_MAX);

	return Promise.resolve({
		loveLost, interactionType: ACTION_IDS.PLEAD
	});
}

/**
 * Handle giving food to pet - generic handler for both meat and vegetables
 * @param guildFoodKey - The key for the guild food property (carnivorousFood or herbivorousFood)
 * @param petModel - Pet model to check diet compatibility
 * @param player - Player giving the food
 */
async function handleGiveFood(guildFoodKey: GuildFoodPropertyKey, petModel: Pet, player: Player): Promise<BadPetActionResult> {
	const {
		LOVE_LOST, OUTCOME_TYPES
	} = SmallEventConstants.BAD_PET;
	const { PET_FOOD } = PetConstants;
	const foodConfig = guildFoodKey === PET_FOOD.CARNIVOROUS_FOOD
		? {
			canEat: petModel.canEatMeat(),
			noFoodOutcome: OUTCOME_TYPES.GIVE_MEAT_NO_FOOD,
			likesOutcome: OUTCOME_TYPES.GIVE_MEAT_LIKES,
			dislikesOutcome: OUTCOME_TYPES.GIVE_MEAT_DISLIKES
		}
		: {
			canEat: petModel.canEatVegetables(),
			noFoodOutcome: OUTCOME_TYPES.GIVE_VEG_NO_FOOD,
			likesOutcome: OUTCOME_TYPES.GIVE_VEG_LIKES,
			dislikesOutcome: OUTCOME_TYPES.GIVE_VEG_DISLIKES
		};

	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;

	if (!guild || guild[guildFoodKey] <= 0) {
		return {
			loveLost: LOVE_LOST.GIVE_FOOD.NO_FOOD,
			interactionType: foodConfig.noFoodOutcome
		};
	}

	// Decrement the food stock
	guild[guildFoodKey] -= 1;
	await guild.save();

	if (foodConfig.canEat) {
		return {
			loveLost: RandomUtils.randInt(LOVE_LOST.GIVE_FOOD.JEALOUS_MIN, LOVE_LOST.GIVE_FOOD.JEALOUS_MAX),
			interactionType: foodConfig.likesOutcome
		};
	}

	const dislikesLoveLost = RandomUtils.crowniclesRandom.bool(LOVE_LOST.GIVE_FOOD.DISLIKES_SUCCESS_CHANCE)
		? 0
		: LOVE_LOST.GIVE_FOOD.DISLIKES_AMOUNT;

	return {
		loveLost: dislikesLoveLost,
		interactionType: foodConfig.dislikesOutcome
	};
}

/**
 * Handle give meat action - depends on guild inventory and pet's diet
 */
function handleGiveMeat(_petEntity: PetEntity, petModel: Pet, player: Player): Promise<BadPetActionResult> {
	return handleGiveFood(PetConstants.PET_FOOD.CARNIVOROUS_FOOD, petModel, player);
}

/**
 * Handle give vegetables action - depends on guild inventory and pet's diet
 */
function handleGiveVeg(_petEntity: PetEntity, petModel: Pet, player: Player): Promise<BadPetActionResult> {
	return handleGiveFood(PetConstants.PET_FOOD.HERBIVOROUS_FOOD, petModel, player);
}

/**
 * Handle flee action - success chance based on player's speed
 */
async function handleFlee(_petEntity: PetEntity, _petModel: Pet, player: Player): Promise<BadPetActionResult> {
	const {
		THRESHOLDS, LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	const playerSpeed = player.getCumulativeSpeed(playerActiveObjects);

	const successChance = playerSpeed > THRESHOLDS.PLAYER_SPEED_FAST ? THRESHOLDS.FLEE_SUCCESS_CHANCE_FAST : 0;

	return {
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.FLEE.MIN, LOVE_LOST.FLEE.MAX),
		interactionType: ACTION_IDS.FLEE
	};
}

/**
 * Handle hide action - success chance based on pet's force (weak pets hide better)
 */
function handleHide(_petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const {
		THRESHOLDS, LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;

	const successChance = petModel.force < THRESHOLDS.PET_FORCE_WEAK ? THRESHOLDS.HIDE_SUCCESS_CHANCE_WEAK : 0;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.HIDE.MIN, LOVE_LOST.HIDE.MAX),
		interactionType: ACTION_IDS.HIDE
	});
}

/**
 * Handle wait action - fixed love loss
 */
function handleWait(_petEntity: PetEntity, _petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	return Promise.resolve({
		loveLost: SmallEventConstants.BAD_PET.LOVE_LOST.WAIT,
		interactionType: SmallEventConstants.BAD_PET.ACTION_IDS.WAIT
	});
}

/**
 * Handle protect action - success chance scales linearly with player's defense
 */
async function handleProtect(_petEntity: PetEntity, _petModel: Pet, player: Player): Promise<BadPetActionResult> {
	const {
		THRESHOLDS, LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	const playerDefense = player.getCumulativeDefense(playerActiveObjects);

	const defenseRatio = Math.min(playerDefense / THRESHOLDS.PLAYER_DEFENSE_MAX, 1);
	const successChance = defenseRatio * THRESHOLDS.PROTECT_MAX_SUCCESS_CHANCE;

	return {
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.PROTECT.FAIL_MIN, LOVE_LOST.PROTECT.FAIL_MAX),
		interactionType: ACTION_IDS.PROTECT
	};
}

/**
 * Handle distract action - fixed success chance
 */
function handleDistract(_petEntity: PetEntity, _petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const {
		THRESHOLDS, LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(
			THRESHOLDS.DISTRACT_SUCCESS_CHANCE,
			LOVE_LOST.DISTRACT.FAIL_MIN,
			LOVE_LOST.DISTRACT.FAIL_MAX
		),
		interactionType: ACTION_IDS.DISTRACT
	});
}

/**
 * Handle calm action - success chance based on pet's current love
 */
function handleCalm(petEntity: PetEntity, _petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const {
		LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;
	const loveRatio = petEntity.lovePoints / PetConstants.MAX_LOVE_POINTS;
	const successChance = LOVE_LOST.CALM.BASE_SUCCESS_CHANCE + loveRatio * LOVE_LOST.CALM.LOVE_BONUS_MULTIPLIER;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.CALM.FAIL_MIN, LOVE_LOST.CALM.FAIL_MAX),
		interactionType: ACTION_IDS.CALM
	});
}

/**
 * Handle imposer action - success chance based on pet's rarity
 */
function handleImposer(_petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const {
		LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;
	const successChance = LOVE_LOST.IMPOSER.BASE_SUCCESS_CHANCE + (petModel.rarity - 1) * LOVE_LOST.IMPOSER.RARITY_BONUS;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.IMPOSER.FAIL_MIN, LOVE_LOST.IMPOSER.FAIL_MAX),
		interactionType: ACTION_IDS.IMPOSER
	});
}

/**
 * Handle energize action - success chance based on pet's vigor
 */
function handleEnergize(petEntity: PetEntity, petModel: Pet, _player: Player): Promise<BadPetActionResult> {
	const {
		LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;
	const vigor = PetUtils.getPetVigor(petModel, petEntity.lovePoints);
	const successChance = LOVE_LOST.ENERGIZE.BASE_SUCCESS_CHANCE + vigor / PetConstants.VIGOR.MAX * LOVE_LOST.ENERGIZE.VIGOR_BONUS_MULTIPLIER;

	return Promise.resolve({
		loveLost: calculateLoveLostFromSuccessChance(successChance, LOVE_LOST.ENERGIZE.FAIL_MIN, LOVE_LOST.ENERGIZE.FAIL_MAX),
		interactionType: ACTION_IDS.ENERGIZE
	});
}

/**
 * All available bad pet actions with their handlers
 */
const BAD_PET_ACTIONS: BadPetAction[] = [
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.INTIMIDATE, handler: handleIntimidate
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.PLEAD, handler: handlePlead
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.GIVE_MEAT, handler: handleGiveMeat
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.GIVE_VEG, handler: handleGiveVeg
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.FLEE, handler: handleFlee
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.HIDE, handler: handleHide
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.WAIT, handler: handleWait
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.PROTECT, handler: handleProtect
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.DISTRACT, handler: handleDistract
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.CALM, handler: handleCalm
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.IMPOSER, handler: handleImposer
	},
	{
		id: SmallEventConstants.BAD_PET.ACTION_IDS.ENERGIZE, handler: handleEnergize
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
	const {
		LOVE_LOST, ACTION_IDS
	} = SmallEventConstants.BAD_PET;
	const defaultResult: BadPetActionResultWithEntity = {
		loveLost: LOVE_LOST.WAIT,
		interactionType: ACTION_IDS.WAIT,
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

		const petData = await getPetData(player);

		response.push(makePacket(SmallEventBadPetPacket, {
			loveLost: result.loveLost,
			interactionType: result.interactionType,
			petId: petData.petTypeId,
			sex: petData.sex,
			petNickname: petData.nickname
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
	if (!destination || !origin) {
		return false;
	}
	if ([destination.id, origin.id].some(mapId => mapId === MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM)) {
		return false;
	}

	// Check if pet is available (handles expedition check with clone talisman logic + petId existence)
	if (!await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT)) {
		return false;
	}

	const petEntity = (await PetEntities.getById(player.petId))!;
	return petEntity.lovePoints > 0;
}

/**
 * Execute the bad pet small event
 */
async function executeSmallEvent(response: CrowniclesPacket[], player: Player, context: PacketContext, _playerActiveObjects: PlayerActiveObjects, testArgs?: string[]): Promise<void> {
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

	const petData = await getPetData(player);

	const collector = new ReactionCollectorBadPetSmallEvent(
		petData.petTypeId,
		petData.sex,
		petData.nickname,
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

