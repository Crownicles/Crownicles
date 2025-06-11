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
	 *Set the color of the embed to the error color
	 */
	setErrorColor(): this {
		this.setColor(<HexColorString>ColorConstants.ERROR);
		return this;
	}
}
