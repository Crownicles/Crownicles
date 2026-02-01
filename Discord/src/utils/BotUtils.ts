import { Guild } from "discord.js";

export type ValidationInfos = {
	validation: string; humans: number; bots: number; ratio: number;
};

/**
 * Functions that are used from the bots perspective
 */
export abstract class BotUtils {
	/**
	 * Get the server's stats of a given guild
	 * @param guild
	 */
	static getValidationInfos(guild: Guild): ValidationInfos {
		const humans = guild.members.cache.filter(member => !member.user.bot).size;
		const bots = guild.members.cache.filter(member => member.user.bot).size;
		const ratio = Math.round(bots / humans * 100);
		let validation = ":white_check_mark:";
		if (ratio > 30 || humans < 30 || humans < 100 && ratio > 20) {
			validation = ":x:";
		}
		else if (ratio > 20 || bots > 15 || humans < 100) {
			validation = ":warning:";
		}
		return {
			validation, humans, bots, ratio
		};
	}

	/**
	 * A map of all necessary strings to mention commands, the key is the command name in english, and the value is the mention
	 */
	static commandsMentions = new Map<string, string>();
}
