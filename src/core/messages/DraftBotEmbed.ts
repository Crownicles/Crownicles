import {MessageEmbed, User} from "discord.js";

declare const JsonReader: any;
declare function format(s: string, replacement: any): string;

/**
 * Base class for bot embeds
 */
export class DraftBotEmbed extends MessageEmbed {
	/**
	 * Default constructor
	 */
	constructor() {
		super();
		// Ignore this for now
		// this.setColor(Constants.MESSAGES.COLORS.DEFAULT);
	}

	/**
	 * Add the title and the user icon as title of the embed
	 * pseudo is automatically replaced in the title. If you have other replacements you have to replace it yourself before
	 * @param title
	 * @param user
	 */
	formatAuthor(title: string, user: User): DraftBotEmbed {
		this.setAuthor(format(title, {
			pseudo: user.username
		}), user.displayAvatarURL());
		return this;
	}

	setErrorColor(): DraftBotEmbed {
		this.setColor(JsonReader.bot.embed.error);
		return this;
	}
}