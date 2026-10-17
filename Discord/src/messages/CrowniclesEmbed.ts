import {
	EmbedBuilder, HexColorString, User
} from "discord.js";
import { ColorConstants } from "../../../Lib/src/constants/ColorConstants";

/**
 * Base class for bot embeds
 */
export class CrowniclesEmbed extends EmbedBuilder {
	/**
	 * Add the title and the user icon as the title of the embed
	 * pseudo is automatically replaced in the title. If you have other replacements, you have to replace it yourself before
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
	 * Set the author with the user's avatar when a user is provided, otherwise fall back to a plain title
	 * @param title
	 * @param user
	 */
	formatAuthorOrTitle(title: string, user: User | null): this {
		return user ? this.formatAuthor(title, user) : this.setTitle(title);
	}

	/**
	 *Set the color of the embed to the error color
	 */
	setErrorColor(): this {
		this.setColor(<HexColorString>ColorConstants.ERROR);
		return this;
	}
}
