import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { LogsPlayersTravels } from "../../../../core/database/logs/models/LogsPlayersTravels";
import {
	HasOne, Op
} from "sequelize";
import {
	getNextSundayMidnight,
	hoursToMilliseconds
} from "../../../../../../Lib/src/utils/TimeUtils";
import { MapLocationDataController } from "../../../../data/MapLocation";
import { MapConstants } from "../../../../../../Lib/src/constants/MapConstants";
import { LogsPlayers } from "../../../../core/database/logs/models/LogsPlayers";
import { LogsMapLinks } from "../../../../core/database/logs/models/LogsMapLinks";

export const commandInfo: ITestCommand = {
	name: "resetjoinboat",
	aliases: ["rjb"],
	description: "Remet à zéro le compteur de voyages vers l'île de guilde du joueur testeur."
};

const resetJoinBoatTestCommand: ExecuteTestCommandLike = async player => {
	// Préparation des données
	const mainContinentId = MapLocationDataController.instance
		.getWithAttributes([MapConstants.MAP_ATTRIBUTES.MAIN_CONTINENT])[0].id;

	const pveIslandEntryIds = MapLocationDataController.instance
		.getWithAttributes([MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY])
		.map(mapLocation => mapLocation.id);

	// Récupérer les travel logs correspondant aux conditions
	const travelLogs = await LogsPlayersTravels.findAll({
		where: {
			date: {
				[Op.gt]: Math.floor((getNextSundayMidnight() - hoursToMilliseconds(7 * 24)) / 1000)
			}
		},
		include: [
			{
				model: LogsPlayers,
				where: { keycloakId: player.keycloakId },
				required: true,
				association: new HasOne(LogsPlayersTravels, LogsPlayers, {
					sourceKey: "playerId", foreignKey: "id"
				})
			},
			{
				model: LogsMapLinks,
				where: {
					start: mainContinentId,
					end: { [Op.in]: pveIslandEntryIds }
				},
				required: true,
				association: new HasOne(LogsPlayersTravels, LogsMapLinks, {
					sourceKey: "mapLinkId", foreignKey: "id"
				})
			}
		]
	});

	// Supprimer chaque enregistrement en se basant sur playerId, mapLinkId et date
	for (const travelLog of travelLogs) {
		await LogsPlayersTravels.destroy({
			where: {
				playerId: travelLog.playerId,
				mapLinkId: travelLog.mapLinkId,
				date: travelLog.date
			}
		});
	}
	return "Votre nombre d'allées sur l'île PVE a été réinitialisé";
};

commandInfo.execute = resetJoinBoatTestCommand;
