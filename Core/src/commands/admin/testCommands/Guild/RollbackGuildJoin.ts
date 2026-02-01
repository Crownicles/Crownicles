import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import Player from "../../../../core/database/game/models/Player";
import { LogsGuildsJoins } from "../../../../core/database/logs/models/LogsGuildJoins";
import { LogsPlayers } from "../../../../core/database/logs/models/LogsPlayers";
import { HasOne } from "sequelize";
import { LogsGuilds } from "../../../../core/database/logs/models/LogsGuilds";
import { hoursToMilliseconds } from "../../../../../../Lib/src/utils/TimeUtils";

export const commandInfo: ITestCommand = {
	name: "rollbackguildjoin",
	aliases: ["rgj"],
	description: "Recule d'une semaine notre date d'adhésion à une guilde."
};

const rollbackGuildJoin: ExecuteTestCommandLike = async (player: Player) => {
	if (!player.guildId) {
		return "Vous n'appartenez pas à une guilde.";
	}

	// Récupérer les logs de join correspondants
	const joinLogs = await LogsGuildsJoins.findOne({
		where: {},
		include: [
			{
				model: LogsPlayers,
				where: { keycloakId: player.keycloakId },
				required: true,
				association: new HasOne(LogsGuildsJoins, LogsPlayers, {
					sourceKey: "addedId", foreignKey: "id"
				})
			},
			{
				model: LogsGuilds,
				where: { id: player.guildId },
				required: true,
				association: new HasOne(LogsGuildsJoins, LogsGuilds, {
					sourceKey: "guildId", foreignKey: "id"
				})
			}
		],
		order: [["date", "DESC"]], // Trier par date décroissante pour prendre la plus récente
		limit: 1
	});


	if (!joinLogs) {
		return "Aucun log de join trouvé pour votre guilde.";
	}

	// Modifier la date
	await LogsGuildsJoins.update(
		{ date: joinLogs.date - hoursToMilliseconds(7 * 24) }, // Soustraire 1 semaine
		{
			where: {
				addedId: joinLogs.addedId,
				guildId: joinLogs.guildId,
				date: joinLogs.date
			}
		}
	);
	return "Votre date d'entrée dans la guilde a été reculée d'une semaine.";
};

commandInfo.execute = rollbackGuildJoin;
