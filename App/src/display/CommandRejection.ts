import {COMMAND_REJECTIONS, CommandRejection} from "ws-packets/src/objects/CommandRejection";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {Lock} from "@/src/design/Sections";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";

const MILLISECONDS_PER_MINUTE = 60_000;

export type PlayerEffect = ProfileRes["effect"];

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

/** Any alteration still running, which Core answers commands requiring no effect with. */
export function activeEffect(profile: ProfileRes): PlayerEffect | null {
	const {effect} = profile;
	return effect.effect !== "none" && effect.hasTimeDisplay && !effect.healed ? effect : null;
}

export function effectLock(effect: PlayerEffect): Lock {
	return {reason: commandRejectionMessage({type: COMMAND_REJECTIONS.EFFECT, currentEffectId: effect.effect, remainingTime: effect.timeLeft})};
}