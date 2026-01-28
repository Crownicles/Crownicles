import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Players } from "../database/game/models/Player";
import { PetEntities } from "../database/game/models/PetEntity";
import { Guilds } from "../database/game/models/Guild";
import { ClassDataController } from "../../data/Class";
import { SmallEventBotFactsPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBotFactsPacket";
import { Maps } from "../maps/Maps";

type BotFactsProperties = {
	possibleInfo: string[];
};

const getNbPlayersWithGivenClass = async (): Promise<[number, number]> => {
	const classToCheck = ClassDataController.instance.getRandomClass();
	return [await Players.getNbPlayersWithClass(classToCheck), classToCheck.id];
};

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player): Promise<void> => {
		const botFactsProperties = SmallEventDataController.instance.getById("botFacts")!.getProperties<BotFactsProperties>();
		const information = RandomUtils.crowniclesRandom.pick(Object.values(botFactsProperties.possibleInfo));
		const packet: SmallEventBotFactsPacket = {
			information, infoNumber: 0
		};

		let array = [];
		switch (information) {
			case "nbMeanPoints":
				packet.infoNumber = await Players.getNbMeanPoints();
				break;
			case "meanWeeklyScore":
				packet.infoNumber = await Players.getMeanWeeklyScore();
				break;
			case "nbPlayersHaventStartedTheAdventure":
				packet.infoNumber = await Players.getNbPlayersHaventStartedTheAdventure();
				break;
			case "levelMean":
				packet.infoNumber = await Players.getLevelMean();
				break;
			case "nbMeanMoney":
				packet.infoNumber = await Players.getNbMeanMoney();
				break;
			case "sumAllMoney":
				packet.infoNumber = await Players.getSumAllMoney();
				break;
			case "richestPlayer":
				packet.infoNumber = await Players.getRichestPlayer();
				break;
			case "trainedPets":
				packet.infoNumber = await PetEntities.getNbTrainedPets();
				break;
			case "percentMalePets":
				packet.infoNumber = Math.round(await PetEntities.getNbPetsGivenSex("m") / await PetEntities.getNbPets() * 10000) / 100;
				break;
			case "percentFemalePets":
				packet.infoNumber = Math.round(await PetEntities.getNbPetsGivenSex("f") / await PetEntities.getNbPets() * 10000) / 100;
				break;
			case "guildLevelMean":
				packet.infoNumber = await Guilds.getGuildLevelMean();
				break;
			case "feistyPets":
				packet.infoNumber = await PetEntities.getNbFeistyPets();
				break;
			case "nbPlayersOnYourMap":
				packet.infoNumber = await player.getNbPlayersOnYourMap();
				break;
			default:
				array = await getNbPlayersWithGivenClass();
				packet.infoNumber = array[0];
				packet.infoComplement = array[1];
		}

		response.push(makePacket(SmallEventBotFactsPacket, packet));
	}
};
