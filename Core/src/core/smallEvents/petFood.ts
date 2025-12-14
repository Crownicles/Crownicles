import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { MapLocationDataController } from "../../data/MapLocation";
import { MapLinkDataController } from "../../data/MapLink";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { millisecondsToHours } from "../../../../Lib/src/utils/TimeUtils";
import { BlockingUtils } from "../utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorPetFoodSmallEvent,
	ReactionCollectorPetFoodInvestigateReaction,
	ReactionCollectorPetFoodSendPetReaction,
	ReactionCollectorPetFoodContinueReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFoodSmallEvent";
import { SmallEventPetFoodPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventPetFoodPacket";
import {
	makePacket, CrowniclesPacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetEntity } from "../database/game/models/PetEntity";
import {
	PetConstants, PetDiet
} from "../../../../Lib/src/constants/PetConstants";
import {
	Pet, PetDataController
} from "../../data/Pet";
import Player from "../database/game/models/Player";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../maps/TravelTime";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { Maps } from "../maps/Maps";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import { PetUtils } from "../utils/PetUtils";

type ReactionHandler = (player: Player, properties: PetFoodProperties) => Promise<string>;

const LOCATION_PROBABILITY_MAPPING = [
	{
		types: SmallEventConstants.PET_FOOD.BAD_SMELL_TYPES,
		probabilities: SmallEventConstants.PET_FOOD.PROBABILITIES.BAD_SMELL
	},
	{
		types: SmallEventConstants.PET_FOOD.VEGETARIAN_TYPES,
		probabilities: SmallEventConstants.PET_FOOD.PROBABILITIES.VEGETARIAN
	},
	{
		types: SmallEventConstants.PET_FOOD.MEAT_TYPES,
		probabilities: SmallEventConstants.PET_FOOD.PROBABILITIES.MEAT
	},
	{
		types: SmallEventConstants.PET_FOOD.GOOD_SMELL_TYPES,
		probabilities: SmallEventConstants.PET_FOOD.PROBABILITIES.GOOD_SMELL
	}
] as const;

const REACTION_HANDLERS: Record<string, ReactionHandler> = {
	[ReactionCollectorPetFoodInvestigateReaction.name]: handleInvestigateReaction,
	[ReactionCollectorPetFoodSendPetReaction.name]: handleSendPetReaction,
	[ReactionCollectorPetFoodContinueReaction.name]: handleContinueReaction
};

type PetFoodProperties = {
	probabilities: {
		badSmell: {
			plus: number;
			minus: number;
			nothing: number;
		};
		continueFind: number;
		investigateFind: number;
	};
	love: {
		badSmell: {
			plus: number;
			minus: number;
		};
		goodSmell: number;
		vegetarian: number;
		meat: number;
		soup: number;
	};
};

/**
 * Get food type probabilities based on map location type
 * @param type
 */
function getProbabilities(type: string): { [key: string]: number } {
	const locationCategory = LOCATION_PROBABILITY_MAPPING.find(entry => entry.types.includes(type));
	if (!locationCategory) {
		return SmallEventConstants.PET_FOOD.PROBABILITIES.DEFAULT;
	}
	return locationCategory.probabilities;
}

/**
 * Determine the type of food found based on the player's current map location
 * @param player - The player finding the food
 * @returns The food type identifier
 */
function getFoodType(player: Player): string {
	const mapLink = MapLinkDataController.instance.getById(player.mapLinkId);
	const endMap = MapLocationDataController.instance.getById(mapLink.endMap);
	const startMap = MapLocationDataController.instance.getById(mapLink.startMap);

	if (endMap.id === MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS || startMap.id === MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS) {
		return SmallEventConstants.PET_FOOD.FOOD_TYPES.SOUP;
	}

	const probabilities = getProbabilities(endMap.type);
	const rand = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
	let cumulativeProbability = 0;
	for (const [foodType, probability] of Object.entries(probabilities)) {
		cumulativeProbability += probability;
		if (rand < cumulativeProbability) {
			return foodType;
		}
	}

	return SmallEventConstants.PET_FOOD.FOOD_TYPES.GOOD_SMELL;
}

/**
 * Calculate love points change based on food type and pet diet
 * @param foodType
 * @param properties
 * @param petModel
 */
const LOVE_CHANGE_HANDLERS: Record<string, (properties: PetFoodProperties, petModel: Pet) => number> = {
	[SmallEventConstants.PET_FOOD.FOOD_TYPES.BAD_SMELL]: (properties: PetFoodProperties): number => {
		const rand = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
		const plusThreshold = properties.probabilities.badSmell.plus;
		const totalThreshold = plusThreshold + properties.probabilities.badSmell.minus;
		if (rand < plusThreshold) {
			return properties.love.badSmell.plus;
		}
		if (rand < totalThreshold) {
			return properties.love.badSmell.minus;
		}
		return SmallEventConstants.PET_FOOD.NO_LOVE_CHANGE;
	},
	[SmallEventConstants.PET_FOOD.FOOD_TYPES.GOOD_SMELL]: (properties: PetFoodProperties): number => properties.love.goodSmell,
	[SmallEventConstants.PET_FOOD.FOOD_TYPES.VEGETARIAN]: (properties: PetFoodProperties, petModel: Pet): number => (petModel.diet === PetDiet.CARNIVOROUS
		? SmallEventConstants.PET_FOOD.NO_LOVE_CHANGE
		: properties.love.vegetarian),
	[SmallEventConstants.PET_FOOD.FOOD_TYPES.MEAT]: (properties: PetFoodProperties, petModel: Pet): number => (petModel.diet === PetDiet.HERBIVOROUS
		? SmallEventConstants.PET_FOOD.NO_LOVE_CHANGE
		: properties.love.meat),
	[SmallEventConstants.PET_FOOD.FOOD_TYPES.SOUP]: (properties: PetFoodProperties): number => properties.love.soup
};

function calculateLoveChange(foodType: string, properties: PetFoodProperties, petModel: Pet): number {
	const handler = LOVE_CHANGE_HANDLERS[foodType];
	if (!handler) {
		return SmallEventConstants.PET_FOOD.NO_LOVE_CHANGE;
	}
	return handler(properties, petModel);
}

/**
 * Apply the outcome of the pet food event, calculating and updating pet love points
 * @param player - The player whose pet is being fed
 * @param eventData - Data about the event including food type, outcome, and properties
 * @param response - Array to add response packets to
 */
async function applyOutcome(
	player: Player,
	eventData: {
		foodType: string; outcome: string; properties: PetFoodProperties; wasInvestigating: boolean;
	},
	response: CrowniclesPacket[]
): Promise<void> {
	const {
		foodType, outcome, properties, wasInvestigating
	} = eventData;
	const petEntity = (await PetEntity.findByPk(player.petId))!;
	const petModel = PetDataController.instance.getById(petEntity.typeId);
	let loveChange = 0;

	if ([
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PLAYER,
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PET,
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_ANYWAY
	].includes(outcome)) {
		loveChange = calculateLoveChange(foodType, properties, petModel);
	}

	if (loveChange !== 0) {
		const updatedLovePoints = petEntity.lovePoints + loveChange;
		petEntity.lovePoints = Math.max(
			0,
			Math.min(updatedLovePoints, PetConstants.MAX_LOVE_POINTS)
		);
		petEntity.hungrySince = new Date();
		await petEntity.save();
	}

	response.push(makePacket(SmallEventPetFoodPacket, {
		outcome,
		foodType,
		loveChange,
		timeLost: wasInvestigating ? SmallEventConstants.PET_FOOD.TRAVEL_TIME_PENALTY_MINUTES : undefined
	}));
}

/**
 * Handle the investigate reaction outcome
 * @param player
 * @param properties
 */
async function handleInvestigateReaction(player: Player, properties: PetFoodProperties): Promise<string> {
	await TravelTime.applyEffect(player, Effect.OCCUPIED, SmallEventConstants.PET_FOOD.TRAVEL_TIME_PENALTY_MINUTES, new Date(), NumberChangeReason.SMALL_EVENT);
	await player.save();
	if (RandomUtils.crowniclesRandom.realZeroToOneInclusive() < properties.probabilities.investigateFind) {
		return SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PLAYER;
	}
	return SmallEventConstants.PET_FOOD.OUTCOMES.PLAYER_FAILED;
}

/**
 * Handle the send pet reaction outcome with hunger-based probability
 * @param player
 */
async function handleSendPetReaction(player: Player): Promise<string> {
	// Pet existence is guaranteed by canBeExecuted
	const petEntity = (await PetEntity.findByPk(player.petId))!;
	const petModel = PetDataController.instance.getById(petEntity.typeId);
	const now = Date.now();
	const hungrySince = petEntity.hungrySince ? new Date(petEntity.hungrySince).getTime() : now;
	const diffHours = millisecondsToHours(now - hungrySince);
	const feedDelay = millisecondsToHours(PetConstants.BREED_COOLDOWN * (petModel.feedDelay ?? 1));

	let probability;
	if (diffHours < feedDelay) {
		probability = SmallEventConstants.PET_FOOD.MIN_PROBABILITY;
	}
	else if (diffHours <= feedDelay * SmallEventConstants.PET_FOOD.FEED_DELAY_MULTIPLIER) {
		probability = SmallEventConstants.PET_FOOD.MAX_PROBABILITY;
	}
	else {
		/*
		 * Probability decreases linearly based on the force (the stronger the pet is,
		 * the faster it becomes weak). Cannot go lower than 10%.
		 */
		const force = petModel.force;
		const decayFactor = force * SmallEventConstants.PET_FOOD.DECAY_FACTOR;
		probability = SmallEventConstants.PET_FOOD.MAX_PROBABILITY - (diffHours - feedDelay * SmallEventConstants.PET_FOOD.FEED_DELAY_MULTIPLIER) * decayFactor;
		if (probability < SmallEventConstants.PET_FOOD.MIN_PROBABILITY) {
			probability = SmallEventConstants.PET_FOOD.MIN_PROBABILITY;
		}
	}

	return RandomUtils.crowniclesRandom.realZeroToOneInclusive() < probability
		? SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PET
		: SmallEventConstants.PET_FOOD.OUTCOMES.PET_FAILED;
}

/**
 * Handle the continue reaction outcome
 * @param properties
 */
function handleContinueReaction(_player: Player, properties: PetFoodProperties): Promise<string> {
	return Promise.resolve(RandomUtils.crowniclesRandom.realZeroToOneInclusive() < properties.probabilities.continueFind
		? SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_ANYWAY
		: SmallEventConstants.PET_FOOD.OUTCOMES.NOTHING);
}

/**
 * Create the callback function executed when the pet food collector ends
 * @param player - The player participating in the event
 * @param foodType - The type of food found
 * @param properties - Pet food event properties
 * @returns The end callback function
 */
function getEndCallback(player: Player, foodType: string, properties: PetFoodProperties): EndCallback {
	return async (collector, response) => {
		const reactionType = collector.getFirstReaction()?.reaction.type;
		const handler = reactionType ? REACTION_HANDLERS[reactionType] : undefined;
		const outcome = handler
			? await handler(player, properties)
			: SmallEventConstants.PET_FOOD.OUTCOMES.NOTHING;

		// Check if the player chose to investigate (which applies the time penalty)
		const wasInvestigating = reactionType === ReactionCollectorPetFoodInvestigateReaction.name;

		await applyOutcome(player, {
			foodType, outcome, properties, wasInvestigating
		}, response);
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FOOD_SMALL_EVENT);
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async (player: Player): Promise<boolean> => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		if (!player.petId || !await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT)) {
			return false;
		}
		const petEntity = await PetEntity.findByPk(player.petId);
		if (!petEntity) {
			return false;
		}
		return petEntity.lovePoints < PetConstants.MAX_LOVE_POINTS;
	},

	executeSmallEvent: (response, player, context): Promise<void> => {
		const properties = SmallEventDataController.instance.getById(SmallEventConstants.PET_FOOD.SMALL_EVENT_NAME).getProperties<PetFoodProperties>();
		const foodType = getFoodType(player);
		const collector = new ReactionCollectorPetFoodSmallEvent(foodType);
		const endCallback = getEndCallback(player, foodType, properties);
		const collectorInstance = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				time: Constants.MESSAGES.COLLECTOR_TIME
			},
			endCallback
		);
		const packet = collectorInstance.build();
		response.push(packet);
		BlockingUtils.blockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FOOD_SMALL_EVENT);
		return Promise.resolve();
	}
};
