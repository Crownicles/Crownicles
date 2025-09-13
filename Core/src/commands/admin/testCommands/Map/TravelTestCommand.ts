import { Maps } from "../../../../core/maps/Maps";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { TravelTime } from "../../../../core/maps/TravelTime";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import { MapLinkDataController } from "../../../../data/MapLink";
import { PlayerSmallEvents } from "../../../../core/database/game/models/PlayerSmallEvent";

export const commandInfo: ITestCommand = {
	name: "travel",
	aliases: ["tp"],
	commandFormat: "<idStart> <idEnd>",
	typeWaited: {
		idStart: TypeKey.INTEGER,
		idEnd: TypeKey.INTEGER
	},
	description: "Téléporte le joueur sur un chemin spécifique entre deux lieux. Voir Core/resources/mapLinks/ pour les chemins valides ou /test mapinfo pour votre position"
};

/**
 * Teleport you on a given path
 */
const travelTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const mapStart = parseInt(args[0], 10);
	const mapEnd = parseInt(args[1], 10);

	const link = MapLinkDataController.instance.getLinkByLocations(mapStart, mapEnd);
	if (!link) {
		const connectedMapsWithStartLinks = MapLinkDataController.instance.getLinksByMapStart(mapStart);
		const conMapsWthStart = [];
		for (const l of connectedMapsWithStartLinks) {
			conMapsWthStart.push(l.endMap);
		}
		throw new Error(`Erreur travel : Maps non reliées. Maps reliées avec la map ${mapStart} : ${conMapsWthStart.toString()}`);
	}
	await TravelTime.removeEffect(player, NumberChangeReason.TEST);

	await Maps.startTravel(player, link, Date.now());
	await PlayerSmallEvents.removeSmallEventsOfPlayer(player.id);
	await player.save();
	return `Vous êtes téléportés entre la map ${mapStart} et la map ${mapEnd} !`;
};

commandInfo.execute = travelTestCommand;
