import { CrowniclesEmbed } from "./CrowniclesEmbed";
import { User } from "discord.js";
import { CrowniclesInteraction } from "./CrowniclesInteraction";
import i18n from "../translations/i18n";
import { escapeUsername } from "../utils/StringUtils";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { LANGUAGE } from "../../../Lib/src/Language";

/**
 * Default error embed with the title and description formatted. If you just want the red color, see {@link CrowniclesEmbed#setErrorColor}
 */
export class CrowniclesErrorEmbed extends CrowniclesEmbed {
	constructor(user: User, context: PacketContext | null, interaction: CrowniclesInteraction, reason: string, isCancelling = false, isBlockedError = true) {
		super();
		this.setErrorColor();
		this.setDescription(reason);

		const isOther = interaction.user !== user;
		this.formatAuthor(i18n.t(isCancelling ? "error:titleCanceled" : isOther && isBlockedError ? "error:titleBlocked" : "error:titleDidntWork", {
			lng: interaction.userLanguage ?? context?.discord?.language ?? LANGUAGE.DEFAULT_LANGUAGE,
			pseudo: escapeUsername(user.displayName)
		}), user);
	}
}
