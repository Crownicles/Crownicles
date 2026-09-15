import {FightParticipant, FightLogEntry, FightEffect, FightStatus} from "ws-packets/src/objects/Fight";
import {i18n} from "@/src/translations/i18n";
import {FightImpact, FightSide, fightCue} from "@/src/display/FightMotion";
import {formatNumber} from "@/src/display/Amounts";
import {petName} from "@/src/display/PetDisplay";

const DESCRIPTIVE_STATUSES = new Set(["new", "active", "stop", "randomAction", "noAction", "generalEffect", "success", "afraid", "failure"]);

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
	const stats = (["attack", "defense", "speed"] as const).flatMap(stat => effect[stat] ? [i18n.t("app:battle.statChange", {stat: i18n.t(`app:arena.stats.${stat}`), value: `${effect[stat]! > 0 ? "+" : ""}${formatNumber(effect[stat]!)}`})] : []);
	if (effect.newAlteration) stats.push(i18n.t("app:battle.story.alteration", {effect: fightActionName(effect.newAlteration)}));
	return stats;
}

function feedbackTarget(side: FightSide, entry: FightLogEntry, status?: FightStatus): string {
	const fighter = [status?.activeFighter, status?.defendingFighter, entry.fighter].find(candidate => candidate && candidate.isSelf === (side === "self"));
	return fighterName(fighter ?? {isSelf: side === "self"});
}

export function fightConsequences(entry: FightLogEntry, status?: FightStatus): string[] {
	const cue = fightCue(entry);
	const consequences: Record<FightSide, string[]> = {self: [], opponent: []};
	for (const impact of cue.impacts) {
		const delta = impact.kind === "damage" ? -impact.amount : impact.amount;
		consequences[impact.side].push(i18n.t(`app:battle.feedback.${impact.kind}`, {value: formatNumber(Math.abs(impact.amount)), sign: delta >= 0 ? "+" : "-"}));
	}
	const opponent = cue.actor === "self" ? "opponent" : "self";
	consequences[cue.actor].push(...statFeedback(entry.fightActionEffectReceived));
	consequences[cue.periodic ? cue.actor : opponent].push(...statFeedback(entry.fightActionEffectDealt));
	return (["self", "opponent"] as const).flatMap(side => consequences[side].length ? [i18n.t("app:battle.story.consequences", {target: feedbackTarget(side, entry, status), effects: consequences[side].join(i18n.t("app:battle.story.separator"))})] : []);
}

function narrativeActor(entry: FightLogEntry): string {
	if (entry.fighter.name || entry.fighter.monsterId) return fighterDisplayName(entry.fighter);
	return i18n.t(entry.fighter.isSelf ? "app:battle.story.self" : "app:battle.story.opponent");
}

function narrativeAction(entry: FightLogEntry): string {
	const attack = i18n.t("app:battle.story.attack", {attack: fightActionName(entry.fightActionId)});
	const fallback = i18n.t(`commands:fight.actions.attacksResults.${entry.status ?? "normal"}.0`, {attack, defaultValue: i18n.t("app:battle.story.generic", {attack})});
	if (DESCRIPTIVE_STATUSES.has(entry.status ?? "")) return i18n.t(`models:fight_actions.${entry.fightActionId}.${entry.status}`, {petNickname: entry.pet ? petName(entry.pet) : "", defaultValue: fallback});
	if (entry.customMessageFail) return i18n.t(`models:fight_actions.${entry.fightActionId}.customMessageFail`, {defaultValue: fallback});
	if (entry.customMessage) return i18n.t(`models:fight_actions.${entry.fightActionId}.customMessage`, {defaultValue: fallback});
	return fallback;
}

export function fightEntryTitle(entry: FightLogEntry): string {
	return entry.pet ? i18n.t("app:battle.story.petAction", {pet: petName(entry.pet)}) : fightActionName(entry.usedFightActionId ?? entry.fightActionId);
}

export function fightNarrative(entry: FightLogEntry, pending = false): string {
	const fighter = narrativeActor(entry);
	if (pending) return i18n.t(entry.pet ? "app:battle.story.preparingPet" : "app:battle.story.preparingAttack", {fighter, pet: entry.pet ? petName(entry.pet) : "", attack: fightActionName(entry.fightActionId)});
	return i18n.t("app:battle.story.sentence", {fighter, action: narrativeAction(entry)});
}
