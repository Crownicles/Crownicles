import { Database } from "../../../../Lib/src/database/Database";
import { getDatabaseConfiguration } from "../../config/DiscordConfig";
import { discordConfig } from "../../bot/CrowniclesShard";
import { DatabaseConstants } from "../../../../Lib/src/constants/DatabaseConstants";

export class DiscordDatabase extends Database {
	constructor() {
		super(getDatabaseConfiguration(discordConfig, "discord", DatabaseConstants.POOLS.DISCORD), `${__dirname}/models`, `${__dirname}/migrations`);
	}
}
