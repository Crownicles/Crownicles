import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { MapLocationDataController } from "../../data/MapLocation";
import { MapLinkDataController } from "../../data/MapLink";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
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
import { PetDataController } from "../../data/Pet";
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

function getFoodType(player: Player): string {
	const mapLink = MapLinkDataController.instance.getById(player.mapLinkId);
	const endMap = MapLocationDataController.instance.getById(mapLink.endMap);
	const startMap = MapLocationDataController.instance.getById(mapLink.startMap);

	if (endMap.id === MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS || startMap.id === MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS) {
		return SmallEventConstants.PET_FOOD.FOOD_TYPES.SOUP;
	}

	const type = endMap.type;
	let probabilities = SmallEventConstants.PET_FOOD.PROBABILITIES.DEFAULT;

	if (SmallEventConstants.PET_FOOD.BAD_SMELL_TYPES.includes(type)) {
		probabilities = SmallEventConstants.PET_FOOD.PROBABILITIES.BAD_SMELL;
	}
	else if (SmallEventConstants.PET_FOOD.VEGETARIAN_TYPES.includes(type)) {
		probabilities = SmallEventConstants.PET_FOOD.PROBABILITIES.VEGETARIAN;
	}
	else if (SmallEventConstants.PET_FOOD.MEAT_TYPES.includes(type)) {
		probabilities = SmallEventConstants.PET_FOOD.PROBABILITIES.MEAT;
	}
	else if (SmallEventConstants.PET_FOOD.GOOD_SMELL_TYPES.includes(type)) {
		probabilities = SmallEventConstants.PET_FOOD.PROBABILITIES.GOOD_SMELL;
	}

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

async function applyOutcome(player: Player, foodType: string, outcome: string, response: CrowniclesPacket[], properties: PetFoodProperties): Promise<void> {
	const petEntity = await PetEntity.findByPk(player.petId);
	const petModel = PetDataController.instance.getById(petEntity.typeId);
	let loveChange = 0;

	if (outcome === SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PLAYER || outcome === SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PET || outcome === SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_ANYWAY) {
		switch (foodType) {
			case SmallEventConstants.PET_FOOD.FOOD_TYPES.BAD_SMELL:
				const rand = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
				if (rand < properties.probabilities.badSmell.plus) {
					loveChange = properties.love.badSmell.plus;
				}
				else if (rand < properties.probabilities.badSmell.plus + properties.probabilities.badSmell.minus) {
					loveChange = properties.love.badSmell.minus;
				}
				else {
					loveChange = 0;
				}
				break;
			case SmallEventConstants.PET_FOOD.FOOD_TYPES.GOOD_SMELL:
				loveChange = properties.love.goodSmell;
				break;
			case SmallEventConstants.PET_FOOD.FOOD_TYPES.VEGETARIAN:
				if (petModel.diet === PetDiet.CARNIVOROUS) {
					loveChange = 0;
				}
				else {
					loveChange = properties.love.vegetarian;
				}
				break;
			case SmallEventConstants.PET_FOOD.FOOD_TYPES.MEAT:
				if (petModel.diet === PetDiet.HERBIVOROUS) {
					loveChange = 0;
				}
				else {
					loveChange = properties.love.meat;
				}
				break;
			case SmallEventConstants.PET_FOOD.FOOD_TYPES.SOUP:
				loveChange = properties.love.soup;
				break;
			default:
				break;
		}
	}

	if (loveChange !== 0) {
		petEntity.lovePoints = Math.min(petEntity.lovePoints + loveChange, PetConstants.MAX_LOVE_POINTS);
		if (petEntity.lovePoints < 0) {
			petEntity.lovePoints = 0;
		}
		petEntity.hungrySince = new Date();
		await petEntity.save();
	}

	response.push(makePacket(SmallEventPetFoodPacket, {
		outcome,
		food: foodType,
		loveChange
	}));
}

function getEndCallback(player: Player, foodType: string, properties: PetFoodProperties): EndCallback {
	return async (collector, response) => {
		const reaction = collector.getFirstReaction();
		let outcome = SmallEventConstants.PET_FOOD.OUTCOMES.NOTHING;

		if (reaction) {
			if (reaction.reaction.type === ReactionCollectorPetFoodInvestigateReaction.name) {
				await TravelTime.timeTravel(player, SmallEventConstants.PET_FOOD.TIME_TRAVEL_TIME, NumberChangeReason.SMALL_EVENT);
				await player.save();
				if (RandomUtils.crowniclesRandom.realZeroToOneInclusive() < properties.probabilities.investigateFind) {
					outcome = SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PLAYER;
				}
				else {
					outcome = SmallEventConstants.PET_FOOD.OUTCOMES.PLAYER_FAILED;
				}
			}
			else if (reaction.reaction.type === ReactionCollectorPetFoodSendPetReaction.name) {
				const petEntity = await PetEntity.findByPk(player.petId);
				const petModel = PetDataController.instance.getById(petEntity.typeId);
				const now = new Date();
				const hungrySince = petEntity.hungrySince ? new Date(petEntity.hungrySince) : new Date();
				const diffHours = (now.getTime() - hungrySince.getTime()) / (1000 * 60 * 60);
				const feedDelay = (PetConstants.BREED_COOLDOWN * (petModel.feedDelay ?? 1)) / (1000 * 60 * 60);

				let probability;
				if (diffHours < feedDelay) {
					probability = SmallEventConstants.PET_FOOD.MIN_PROBABILITY;
				}
				else if (diffHours <= feedDelay * SmallEventConstants.PET_FOOD.FEED_DELAY_MULTIPLIER) {
					probability = SmallEventConstants.PET_FOOD.MAX_PROBABILITY;
				}
				else {
					// Probability decreases linearly based on the force (more the pet is strong faster it becomes weak)
					// cannot go lower than 10%
					const force = petModel.force;
					const decayFactor = force * SmallEventConstants.PET_FOOD.DECAY_FACTOR;
					probability = SmallEventConstants.PET_FOOD.MAX_PROBABILITY - (diffHours - feedDelay * SmallEventConstants.PET_FOOD.FEED_DELAY_MULTIPLIER) * decayFactor;
					if (probability < SmallEventConstants.PET_FOOD.MIN_PROBABILITY) {
						probability = SmallEventConstants.PET_FOOD.MIN_PROBABILITY;
					}
				}

				if (RandomUtils.crowniclesRandom.realZeroToOneInclusive() < probability) {
					outcome = SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PET;
				}
				else {
					outcome = SmallEventConstants.PET_FOOD.OUTCOMES.PET_FAILED;
				}
			}
			else if (reaction.reaction.type === ReactionCollectorPetFoodContinueReaction.name) {
				if (RandomUtils.crowniclesRandom.realZeroToOneInclusive() < properties.probabilities.continueFind) {
					outcome = SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_ANYWAY;
				}
			}
		}

		await applyOutcome(player, foodType, outcome, response, properties);
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PET_FOOD_SMALL_EVENT);
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async (player: Player): Promise<boolean> => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		if (!player.petId) {
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
