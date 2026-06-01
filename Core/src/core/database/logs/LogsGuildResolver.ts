import {
	Guild
} from "../game/models/Guild";
import { GuildLikeType } from "../../types/GuildLikeType";
import { LogsGuilds } from "./models/LogsGuilds";
import { dateToLogs } from "../../../../../Lib/src/utils/TimeUtils";

/**
 * Find or create a guild row in the logs database from its game representation.
 */
export async function findOrCreateLogsGuild(guild: Guild | GuildLikeType): Promise<LogsGuilds> {
	return (await LogsGuilds.findOrCreate({
		where: {
			gameId: guild.id,
			creationTimestamp: dateToLogs(guild.creationDate)
		},
		defaults: { name: guild.name }
	}))[0];
}
