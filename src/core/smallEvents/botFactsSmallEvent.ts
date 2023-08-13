import {SmallEvent} from "./SmallEvent";
import {CommandInteraction} from "discord.js";
import {DraftBotEmbed} from "../messages/DraftBotEmbed";
import {Translations} from "../Translations";
import {RandomUtils} from "../utils/RandomUtils";
import {format} from "../utils/StringFormatter";
import {Player, Players} from "../database/game/models/Player";
import {PetEntities} from "../database/game/models/PetEntity";
import {Guilds} from "../database/game/models/Guild";
import {Classes} from "../database/game/models/Class";
import {Constants} from "../Constants";
import {readdir} from "fs/promises";
import {Maps} from "../maps/Maps";

/**
 * Gives how many players have a random class
 * @param {("fr"|"en")} language
 * @return {Promise<(*)[]>}
 */
const getNbPlayersWithGivenClass = async (language: string): Promise<[number, string]> => {
	const classToCheck = await Classes.getById(parseInt(RandomUtils.draftbotRandom.pick(await readdir("resources/text/classes"))
		.slice(0, -5), 10));
	return [await Players.getNbPlayersWithClass(classToCheck), language === Constants.LANGUAGE.FRENCH ? classToCheck.fr : classToCheck.en];
};

export const smallEvent: SmallEvent = {
	/**
	 * Check if small event can be executed
	 */
	canBeExecuted(player: Player): Promise<boolean> {
		return Promise.resolve(Maps.isOnContinent(player));
	},

	/**
	 * Throw a random, verified, fact to the player
	 * @param interaction
	 * @param language
	 * @param player
	 * @param seEmbed
	 */
	async executeSmallEvent(interaction: CommandInteraction, language: string, player: Player, seEmbed: DraftBotEmbed): Promise<void> {
		const tr = Translations.getModule("smallEvents.botFacts", language);

		const base = seEmbed.data.description + Translations.getModule("smallEventsIntros", language).getRandom("intro");

		const outReceived = RandomUtils.draftbotRandom.pick(tr.getKeys("possiblesInfos"));
		let result;
		let complement = "";
		let array = [];
		switch (outReceived) {
		case "nbMeanPoints":
			result = await Players.getNbMeanPoints();
			break;
		case "meanWeeklyScore":
			result = await Players.getMeanWeeklyScore();
			break;
		case "nbPlayersHaventStartedTheAdventure":
			result = await Players.getNbPlayersHaventStartedTheAdventure();
			break;
		case "levelMean":
			result = await Players.getLevelMean();
			break;
		case "nbMeanMoney":
			result = await Players.getNbMeanMoney();
			break;
		case "sumAllMoney":
			result = await Players.getSumAllMoney();
			break;
		case "richestPlayer":
			result = await Players.getRichestPlayer();
			break;
		case "trainedPets":
			result = await PetEntities.getNbTrainedPets();
			break;
		case "percentMalePets":
			result = Math.round(await PetEntities.getNbPetsGivenSex("m") / await PetEntities.getNbPets() * 10000) / 100;
			break;
		case "percentFemalePets":
			result = Math.round(await PetEntities.getNbPetsGivenSex("f") / await PetEntities.getNbPets() * 10000) / 100;
			break;
		case "guildLevelMean":
			result = await Guilds.getGuildLevelMean();
			break;
		case "feistyPets":
			result = await PetEntities.getNbFeistyPets();
			break;
		case "nbPlayersOnYourMap":
			result = await player.getNbPlayersOnYourMap();
			break;
		default:
			array = await getNbPlayersWithGivenClass(language);
			result = array[0];
			complement = array[1];
		}
		seEmbed.setDescription(base +
			format(
				tr.getRandom("stories"),
				{
					botFact: format(
						tr.get(`possiblesInfos.${outReceived}`),
						{
							infoNumber: result,
							infoComplement: complement
						}
					)
				}
			)
		);
		await interaction.editReply({embeds: [seEmbed]});
	}
};
