import {SmallEventFuncs} from "../../data/SmallEvent";
import {Maps} from "../maps/Maps";
import {PetEntities, PetEntity} from "../database/game/models/PetEntity";
import {Pet, PetDataController} from "../../data/Pet";
import {NumberChangeReason} from "../../../../Lib/src/constants/LogsConstants";
import {RandomUtils} from "../../../../Lib/src/utils/RandomUtils";
import {SmallEventConstants} from "../../../../Lib/src/constants/SmallEventConstants";
import {giveRandomItem} from "../utils/ItemUtils";
import {TravelTime} from "../maps/TravelTime";
import {Effect} from "../../../../Lib/src/enums/Effect";
import {SmallEventPetPacket} from "../../../../Lib/src/packets/smallEvents/SmallEventPetPacket";
import {DraftBotPacket, makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import Player from "../database/game/models/Player";
import {PetConstants, PetInteraction} from "../../../../Lib/src/constants/PetConstants";
import {Constants} from "../../../../Lib/src/constants/Constants";
import {LogsDatabase} from "../database/logs/LogsDatabase";
import {ErrorPacket} from "../../../../Lib/src/packets/commands/ErrorPacket";
import {MissionsController} from "../missions/MissionsController";
import {giveFoodToGuild} from "../utils/FoodUtils";

function generatePossibleIssues(player: Player, petEntity: PetEntity, pet: Pet):PetInteraction[] {
	if (petEntity.isFeisty()) {
		return Object.values(PetConstants.PET_INTERACTIONS.PET_FEISTY);
	}
	const petLevel = pet.rarity + (petEntity.getLoveLevelNumber() === 5 ? 1 : 0);
	const interactions:PetInteraction[] = [];
	for (let i = 0; i <= petLevel; i++) {
		interactions.push(...Object.values(PetConstants.PET_INTERACTIONS.PET_NORMAL[i]));
	}
	return Object.values(interactions);
}

function pickRandomInteraction(possibleIssues:PetInteraction[]): string {
	const totalWeight = possibleIssues.map((pi:PetInteraction):number => pi.probabilityWeight).reduce((a:number, b:number):number => a + b);
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

async function managePickedInteraction(packet:SmallEventPetPacket, response:DraftBotPacket[], context: PacketContext, player:Player,petEntity:PetEntity):Promise<void> {
	switch (packet.interactionName) {
	case PetConstants.PET_INTERACTIONS_NAMES.WIN_ENERGY:
		packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.ENERGY);
		player.addEnergy(packet.amount, NumberChangeReason.SMALL_EVENT);
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.WIN_FOOD:
		if (player.guildId) {
			packet.food = RandomUtils.draftbotRandom.pick(Object.values(Constants.PET_FOOD));
			await giveFoodToGuild(response, player, packet.food, 1,NumberChangeReason.SMALL_EVENT);
		}
		else {
			packet.interactionName = PetConstants.PET_INTERACTIONS_NAMES.NOTHING;
		}
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.WIN_POINTS:
		packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.POINTS);
		await player.addScore({amount: packet.amount, response, reason: NumberChangeReason.SMALL_EVENT});
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.WIN_LOVE:
		packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.LOVE_POINTS);
		await petEntity.changeLovePoints({player, amount: packet.amount, response, reason: NumberChangeReason.SMALL_EVENT});
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.WIN_MONEY:
		packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.MONEY);
		await player.addMoney({amount: packet.amount, response, reason: NumberChangeReason.SMALL_EVENT});
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.WIN_TIME:
		packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.TIME);
		await TravelTime.timeTravel(player, packet.amount, NumberChangeReason.SMALL_EVENT);
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.WIN_HEALTH:
		packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.HEALTH);
		await player.addHealth(packet.amount, response, NumberChangeReason.SMALL_EVENT);
		await MissionsController.update(player, response, {missionId: "petEarnHealth"});
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.WIN_ITEM:
		await giveRandomItem(context, response, player);
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.WIN_BADGE:
		player.addBadge(Constants.BADGES.PET_TAMER);
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.LOSE_HEALTH:
		packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.HEALTH);
		await player.addHealth(-packet.amount, response, NumberChangeReason.SMALL_EVENT);
		await player.killIfNeeded(response, NumberChangeReason.SMALL_EVENT);
		break;

	case PetConstants.PET_INTERACTIONS_NAMES.LOSE_MONEY:
		packet.amount = RandomUtils.rangedInt(SmallEventConstants.PET.MONEY);
		await player.addMoney({amount: -packet.amount, response, reason: NumberChangeReason.SMALL_EVENT});
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
		LogsDatabase.logPetFree(petEntity).then();
		await petEntity.destroy();
		player.petId = null;
		break;
	default:
		break;
	}
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: (player) => Maps.isOnContinent && player.petId === null,
	executeSmallEvent: async (context, response, player): Promise<void> => {
		const petEntity = await PetEntities.getById(player.petId);
		const pet = PetDataController.instance.getById(petEntity.typeId);
		const possibleIssues = generatePossibleIssues(player, petEntity, pet);
		const packet: SmallEventPetPacket = {
			interactionName: pickRandomInteraction(possibleIssues),
			petTypeId: petEntity.typeId,
			petSex: petEntity.sex
		};
		if (packet.interactionName === Constants.DEFAULT_ERROR) {
			response.push(makePacket(ErrorPacket, {message: "SmallEvent Pet : cannot determine an interaction for the user"}));
			return;
		}
		await managePickedInteraction(packet,response,context,player,petEntity);
		response.push(makePacket(SmallEventPetPacket, packet));
	}
};