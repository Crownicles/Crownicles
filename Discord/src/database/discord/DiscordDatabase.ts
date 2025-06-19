import { Database } from "../../../../Lib/src/database/Database";
import { getDatabaseConfiguration } from "../../config/DiscordConfig";
import { discordConfig } from "../../bot/CrowniclesShard";

export class DiscordDatabase extends Database {
	constructor() {
		super(getDatabaseConfiguration(discordConfig, "discord"), `${__dirname}/models`, `${__dirname}/migrations`);
	}
}
