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
import { MissionsController } from "../missions/MissionsController";
import { giveFoodToGuild } from "../utils/FoodUtils";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { PetFood } from "../../../../Lib/src/types/PetFood";
import { Badge } from "../../../../Lib/src/types/Badge";
import { PetUtils } from "../utils/PetUtils";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";

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
 * @param packet
 * @param response
 * @param context
 * @param player
 * @param petEntity
 */
async function managePickedInteraction(packet: SmallEventPetPacket, response: CrowniclesPacket[], context: PacketContext, player: Player, petEntity: PetEntity): Promise<void> {
	switch (packet.interactionName) {
		case PetConstants.PET_INTERACTIONS_NAMES.WIN_ENERGY:
			if (player.fightPointsLost === 0) {
				packet.interactionName = PetConstants.PET_INTERACTIONS_NAMES.NOTHING;
				break;
			}
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.ENERGY);
			player.addEnergy(packet.amount, NumberChangeReason.SMALL_EVENT);
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.WIN_FOOD:
			if (!player.guildId) {
				packet.interactionName = PetConstants.PET_INTERACTIONS_NAMES.NOTHING;
				break;
			}
			packet.food = RandomUtils.crowniclesRandom.pick(Object.values(PetConstants.PET_FOOD)) as PetFood;
			await giveFoodToGuild(response, player, packet.food, 1, NumberChangeReason.SMALL_EVENT);
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.WIN_POINTS:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.POINTS);
			await player.addScore({
				amount: packet.amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.WIN_LOVE:
			if (petEntity.getLoveLevelNumber() === PetConstants.LOVE_LEVEL.TRAINED) {
				packet.interactionName = PetConstants.PET_INTERACTIONS_NAMES.NOTHING;
				break;
			}
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.LOVE_POINTS);
			await petEntity.changeLovePoints({
				player,
				amount: packet.amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.WIN_MONEY:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.MONEY);
			await player.addMoney({
				amount: packet.amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.WIN_TIME:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.TIME);
			await TravelTime.timeTravel(player, packet.amount, NumberChangeReason.SMALL_EVENT);
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.WIN_HEALTH:
			if (player.health === player.getMaxHealth()) {
				packet.interactionName = PetConstants.PET_INTERACTIONS_NAMES.NOTHING;
				break;
			}
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.HEALTH);
			await player.addHealth(packet.amount, response, NumberChangeReason.SMALL_EVENT);
			await MissionsController.update(player, response, { missionId: "petEarnHealth" });
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.WIN_ITEM:
			await giveRandomItem(context, response, player);
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.WIN_BADGE:
			if (await PlayerBadgesManager.hasBadge(player.id, Badge.LEGENDARY_PET)) {
				packet.interactionName = PetConstants.PET_INTERACTIONS_NAMES.NOTHING;
				break;
			}
			await PlayerBadgesManager.addBadge(player.id, Badge.LEGENDARY_PET);
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.LOSE_HEALTH:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.HEALTH);
			await player.addHealth(-packet.amount, response, NumberChangeReason.SMALL_EVENT);
			await player.killIfNeeded(response, NumberChangeReason.SMALL_EVENT);
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.LOSE_MONEY:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.MONEY);
			await player.addMoney({
				amount: -packet.amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.LOSE_TIME:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.TIME);
			await TravelTime.applyEffect(player, Effect.OCCUPIED, packet.amount, new Date(), NumberChangeReason.SMALL_EVENT);
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.LOSE_LOVE:
			packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.LOVE_POINTS);
			await petEntity.changeLovePoints({
				player,
				amount: -packet.amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			break;

		case PetConstants.PET_INTERACTIONS_NAMES.PET_FLEE:
			LogsDatabase.logPetFree(petEntity)
				.then();
			await petEntity.destroy();
			player.petId = null;
			break;
		default:
			break;
	}
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async player => Maps.isOnContinent(player) && await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT),
	executeSmallEvent: async (response, player, context): Promise<void> => {
		const petEntity = await PetEntities.getById(player.petId);
		const pet = PetDataController.instance.getById(petEntity.typeId);
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
