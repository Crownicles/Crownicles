import {FightParticipant, FightLogEntry, FightEffect} from "ws-packets/src/objects/Fight";
import {i18n} from "@/src/translations/i18n";
import {FightImpact} from "@/src/display/FightMotion";
import type {FightEffectTone} from "@/src/components/FightNarrative";
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

const EFFECT_TONES: Readonly<Record<string, FightEffectTone>> = {
	damages: "damage", reflectedDamages: "damage", energy: "gain", breath: "breath"
};

const EFFECT_ICONS: Readonly<Record<string, string>> = {
	damages: "unitValues.lostHealth", reflectedDamages: "unitValues.lostHealth", energy: "unitValues.energy", breath: "unitValues.breath",
	attack: "unitValues.attack", defense: "unitValues.defense", speed: "unitValues.speed"
};

export type FightConsequence = {id: string; tone: FightEffectTone; text: string; iconPath?: string};

function effectLines(effect: FightEffect | undefined, side: "self" | "opponent"): FightConsequence[] {
	if (!effect) return [];
	return Object.entries(effect).flatMap(([key, value]): FightConsequence[] => {
		const common = {id: `${side}-${key}`, tone: EFFECT_TONES[key] ?? "neutral", ...EFFECT_ICONS[key] ? {iconPath: EFFECT_ICONS[key]} : {}};
		if (typeof value === "number") {
			const text = i18n.t(`commands:fight.actions.fightActionEffects.${side}.${key}`, {operator: value >= 0 ? "+" : "-", amount: Math.abs(value), defaultValue: ""});
			return text ? [{...common, text}] : [];
		}
		if (!value) return [];
		const text = i18n.t(`commands:fight.actions.fightActionEffects.${side}.${key}`, {effect: fightActionName(value), defaultValue: ""});
		// An alteration is better recognised by its own icon than by a generic one.
		return text ? [{...common, text, iconPath: `fightActions.${value}`}] : [];
	});
}

/** Same wording as the Discord history: effects received by the actor, then effects dealt to its target. */
export function fightConsequences(entry: FightLogEntry): FightConsequence[] {
	return [...effectLines(entry.fightActionEffectReceived, "self"), ...effectLines(entry.fightActionEffectDealt, "opponent")];
}

function narrativeActor(entry: FightLogEntry): string {
	if (entry.fighter.name || entry.fighter.monsterId) return fighterDisplayName(entry.fighter);
	return i18n.t(entry.fighter.isSelf ? "app:battle.story.self" : "app:battle.story.opponent");
}

/** Discord picks a random variant; the app keeps the one drawn for a given action so it never changes while read. */
function attackResult(entry: FightLogEntry, seed: number, attack: string): string {
	const status = entry.status ?? "normal";
	const variants = i18n.tArray(`commands:fight.actions.attacksResults.${status}`);
	if (!variants.length) return i18n.t("app:battle.story.generic", {attack});
	return i18n.t(`commands:fight.actions.attacksResults.${status}.${Math.abs(seed) % variants.length}`, {attack});
}

function narrativeAction(entry: FightLogEntry, seed: number): string {
	const attack = fightActionName(entry.fightActionId);
	const petNickname = entry.pet ? petName(entry.pet) : "";
	// Same order as the Discord history, so both frontends tell the same thing about an action.
	if (DESCRIPTIVE_STATUSES.has(entry.status ?? "")) return i18n.t(`models:fight_actions.${entry.fightActionId}.${entry.status}`, {petNickname, defaultValue: ""}) || attackResult(entry, seed, attack);
	if (entry.customMessage) return i18n.t(`models:fight_actions.${entry.fightActionId}.customMessage`, {defaultValue: ""}) || attackResult(entry, seed, attack);
	if (entry.customMessageFail) return i18n.t(`models:fight_actions.${entry.fightActionId}.customMessageFail`, {defaultValue: ""}) || attackResult(entry, seed, attack);
	return attackResult(entry, seed, attack);
}

export function fightEntryTitle(entry: FightLogEntry): string {
	return entry.pet ? i18n.t("app:battle.story.petAction", {pet: petName(entry.pet)}) : fightActionName(entry.usedFightActionId ?? entry.fightActionId);
}

export function fightNarrative(entry: FightLogEntry, seed = 0): string {
	return i18n.t("app:battle.story.sentence", {fighter: narrativeActor(entry), action: narrativeAction(entry, seed)});
}
