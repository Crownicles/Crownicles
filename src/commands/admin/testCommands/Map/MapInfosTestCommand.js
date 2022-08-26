import {DraftBotEmbed} from "../../../../core/messages/DraftBotEmbed";
import {Entities} from "../../../../core/database/game/models/Entity";
import {MapLocations} from "../../../../core/database/game/models/MapLocation";
import {Maps} from "../../../../core/Maps";

/**
 * Give you informations about the map you are on
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @return {String} - The successful message formatted
 */
const mapInfosTestCommand = async (language, interaction) => {
	const [entity] = await Entities.getOrRegister(interaction.user.id);

	const mapEmbed = new DraftBotEmbed();
	const currMap = await entity.Player.getDestination();
	const prevMap = await entity.Player.getPreviousMap();
	const travelling = Maps.isTravelling(entity.Player);

	mapEmbed.formatAuthor("🗺️ Map debugging", interaction.user)
		.addField(
			travelling ? "Next map" : "Current map",
			currMap.getDisplayName(language) + " (id: " + currMap.id + ")",
			true
		)
		.addField(
			"Previous map",
			prevMap ? prevMap.getDisplayName(language) + " (id: " + prevMap.id + ")" : "None",
			true
		)
		.addField(
			"Travelling",
			Maps.isTravelling(entity.Player) ? ":clock1: For " + minutesToString(millisecondsToMinutes(Maps.getTravellingTime(entity.Player))) : ":x: No",
			true
		)
		.setColor(TEST_EMBED_COLOR.SUCCESSFUL);

	if (!travelling) {
		const availableMaps = await Maps.getNextPlayerAvailableMaps(entity.Player);
		let field = "";
		for (let i = 0; i < availableMaps.length; ++i) {
			const map = await MapLocations.getById(availableMaps[i]);
			field += map.getDisplayName(language) + " (id: " + map.id + ")" + "\n";
		}
		mapEmbed.addField("Next available maps", field, true);
	}
	else {
		mapEmbed.addField("Players", ":speech_balloon: " + await currMap.playersCount(prevMap.id) + " player(s) on this map", true);
	}
	return mapEmbed;
};

module.exports.commandInfo = {
	name: "mapinfo",
	messageWhenExecuted: "",
	description: "Donne des informations pratiques sur la map sur laquelle vous êtes",
	commandTestShouldReply: true,
	execute: mapInfosTestCommand
};