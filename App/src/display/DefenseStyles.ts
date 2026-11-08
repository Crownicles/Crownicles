import { AppIcons } from "@/src/AppIcons";
import { i18n } from "@/src/translations/i18n";

/** Translation and emoji key of the choice that lets a different style be picked at random at each fight. */
const RANDOM_DEFENSE_STYLE = "random";

/** A missing personality is a different style picked at random at each fight. */
function defenseStyleKey(personality: string | undefined): string {
	return personality ?? RANDOM_DEFENSE_STYLE;
}

export function defenseStyleName(personality: string | undefined): string {
	return i18n.t(`commands:defense.personalities.${defenseStyleKey(personality)}.name`);
}

export function defenseStyleDescription(personality: string | undefined): string {
	return i18n.t(`commands:defense.personalities.${defenseStyleKey(personality)}.description`);
}

export function defenseStyleIcon(personality: string | undefined): string | null {
	return AppIcons.getIconOrNull(`defensePersonalities.${defenseStyleKey(personality)}`);
}
