import { CrowniclesEmbed } from "./CrowniclesEmbed";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import i18n from "../translations/i18n";
import { Language } from "../../../Lib/src/Language";
import { User } from "discord.js";
import { EmoteUtils } from "../utils/EmoteUtils";
import { escapeUsername } from "../utils/StringUtils";

export class CrowniclesSmallEventEmbed extends CrowniclesEmbed {
	constructor(smallEventId: keyof typeof CrowniclesIcons.smallEvents, description: string, user: User, lng: Language) {
		super();
		this.setAuthor({
			name: i18n.t("commands:report.journal", {
				lng,
				pseudo: escapeUsername(user.displayName)
			}),
			iconURL: user.displayAvatarURL()
		});
		this.setDescription(`${EmoteUtils.translateEmojiToDiscord(CrowniclesIcons.smallEvents[smallEventId])} ${description}`);
	}
}
