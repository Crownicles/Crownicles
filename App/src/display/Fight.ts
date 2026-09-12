import {FightParticipant} from "ws-packets/src/objects/Fight";
import {i18n} from "@/src/translations/i18n";

export function fighterName(fighter: FightParticipant): string {
	if (fighter.isSelf) return i18n.t("app:arena.you");
	if (fighter.monsterId) return i18n.t(`models:monsters.${fighter.monsterId}.name`, {defaultValue: i18n.t("app:arena.opponent")});
	return fighter.name ?? i18n.t("app:arena.opponent");
}

export function fightActionName(actionId: string): string {
	return i18n.t(`models:fight_actions.${actionId}.name`, {count: 1, defaultValue: i18n.t("app:arena.action")});
}
