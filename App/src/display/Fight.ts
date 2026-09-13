import {FightParticipant, FightLogEntry, FightEffect} from "ws-packets/src/objects/Fight";
import {i18n} from "@/src/translations/i18n";
import {FightImpact, fightCue} from "@/src/display/FightMotion";
import {formatNumber} from "@/src/display/Amounts";

export function fighterSubtitle(fighter: FightParticipant): string {
	const classLabel = fighter.classId === undefined ? "" : i18n.t(`models:classes.${fighter.classId}`);
	const level = fighter.level === undefined ? "" : i18n.t("app:battle.level", {level: fighter.level});
	return [classLabel, level].filter(Boolean).join(" · ");
}

export function fighterName(fighter: FightParticipant): string {
	if (fighter.isSelf) return i18n.t("app:arena.you");
	if (fighter.monsterId) return i18n.t(`models:monsters.${fighter.monsterId}.name`, {defaultValue: i18n.t("app:arena.opponent")});
	return fighter.name ?? i18n.t("app:arena.opponent");
}

export function fighterDisplayName(fighter: FightParticipant): string {
	return fighter.name ?? fighterName(fighter);
}

export function fightActionName(actionId: string): string {
	return i18n.t(`models:fight_actions.${actionId}.name`, {count: 1, defaultValue: i18n.t("app:arena.action")});
}

export function fightImpactLabel(impact: FightImpact): string {
	const delta = impact.kind === "damage" ? -impact.amount : impact.amount;
	return `${delta >= 0 ? "+" : "-"}${formatNumber(Math.abs(impact.amount))}`;
}

function statFeedback(effect: FightEffect | undefined): string[] {
	if (!effect) return [];
	return (["attack", "defense", "speed"] as const).flatMap(stat => effect[stat] ? [i18n.t("app:battle.statChange", {stat: i18n.t(`app:arena.stats.${stat}`), value: `${effect[stat]! > 0 ? "+" : ""}${formatNumber(effect[stat]!)}`})] : []);
}

export function fightFeedback(entry: FightLogEntry): string {
	const cue = fightCue(entry);
	const effects = cue.impacts.map(impact => {
		const delta = impact.kind === "damage" ? -impact.amount : impact.amount;
		return i18n.t(`app:battle.feedback.${impact.kind}`, {value: formatNumber(Math.abs(impact.amount)), sign: delta >= 0 ? "+" : "-"});
	});
	const stats = [...statFeedback(entry.fightActionEffectReceived), ...statFeedback(entry.fightActionEffectDealt)];
	const outcome = effects.length || stats.length ? [...effects, ...stats].join(" · ") : i18n.t(`app:arena.status.${entry.status ?? "normal"}`, {defaultValue: i18n.t("app:arena.status.other")});
	return i18n.t("app:battle.actionResult", {fighter: fighterName(entry.fighter), result: outcome});
}
