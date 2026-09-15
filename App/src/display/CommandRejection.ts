import {COMMAND_REJECTIONS, CommandRejection} from "ws-packets/src/objects/CommandRejection";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

const MILLISECONDS_PER_MINUTE = 60_000;

export function commandRejectionMessage(rejection: CommandRejection): string {
	switch (rejection.type) {
		case COMMAND_REJECTIONS.LEVEL: return i18n.t("app:requirements.level", {level: rejection.requiredLevel});
		case COMMAND_REJECTIONS.LOCATION: return i18n.t("app:requirements.location");
		case COMMAND_REJECTIONS.ORACLE: return i18n.t("app:requirements.oracle");
		case COMMAND_REJECTIONS.GUILD: return i18n.t("app:requirements.guild");
		case COMMAND_REJECTIONS.GUILD_ROLE: return i18n.t("app:requirements.guildRole", {role: i18n.t(`app:guild.requiredRoles.${rejection.role}`)});
		default: {
			const effect = i18n.t(`error:effects.${rejection.currentEffectId}.self`);
			return rejection.remainingTime > 0 ? i18n.t("app:requirements.effect", {effect, duration: formatDurationMinutes(rejection.remainingTime / MILLISECONDS_PER_MINUTE)}) : effect;
		}
	}
}