import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { LogsGuildsJoins } from "../../../../core/database/logs/models/LogsGuildJoins";
import { LogsPlayers } from "../../../../core/database/logs/models/LogsPlayers";
import { LogsGuilds } from "../../../../core/database/logs/models/LogsGuilds";

export const commandInfo: ITestCommand = {
	name: "deletejoinguild",
	aliases: ["djg"],
	description: "Efface la date à laquelle vous avez rejoint la guilde"
};

const deleteJoinGuildTestCommand: ExecuteTestCommandLike = async player => {
	const logsGuild = await LogsGuilds.findOne({
		where: {
			gameId: player.guildId
		}
	});
	const logsPlayer = await LogsPlayers.findOne({
		where: {
			keycloakId: player.keycloakId
		}
	});
	await LogsGuildsJoins.destroy({
		where: {
			guildId: logsGuild.id,
			addedId: logsPlayer.id
		}
	});
	return "La date à laquelle vous avez rejoint la guilde a été supprimée !";
};

commandInfo.execute = deleteJoinGuildTestCommand;
