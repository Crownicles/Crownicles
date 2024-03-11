import {EmbedBuilder, HexColorString, User} from "discord.js";
import {Constants} from "../../../Lib/src/constants/Constants";

/**
 * Base class for bot embeds
 */
export class DraftBotEmbed extends EmbedBuilder {
	/**
	 * Default constructor
	 */
	constructor() {
		super();
	}

	/**
	 * Add the title and the user icon as title of the embed
	 * pseudo is automatically replaced in the title. If you have other replacements you have to replace it yourself before
	 * @param title
	 * @param user
	 */
	formatAuthor(title: string, user: User): this {
		this.setAuthor({
			name: title,
			iconURL: user.displayAvatarURL()
		});
		return this;
	}

	/**
	 *Set the color of the embed to the error color
	 */
	setErrorColor(): this {
		this.setColor(<HexColorString>Constants.MESSAGES.COLORS.ERROR);
		return this;
	}
}