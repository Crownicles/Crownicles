import {FightEffect, FightLogEntry} from "ws-packets/src/objects/Fight";
import {Theme} from "@/src/design/Theme";

export const FIGHT_MOTIONS = {
	SLASH: "slash", RAPID: "rapid", HEAVY: "heavy", PIERCE: "pierce", SHOT: "shot", RETURN: "return",
	FLAME: "flame", FROST: "frost", LIGHTNING: "lightning", WAVE: "wave", POISON: "poison",
	SHIELD: "shield", BLESSING: "blessing", HEAL: "heal", REST: "rest", CHARGE: "charge",
	CURSE: "curse", DRAIN: "drain", ROAR: "roar", SUMMON: "summon", DODGE: "dodge",
	DEBUFF: "debuff", QUAKE: "quake", BITE: "bite", CLAW: "claw", MIMIC: "mimic"
} as const;
export type FightMotion = typeof FIGHT_MOTIONS[keyof typeof FIGHT_MOTIONS];
export type FightSide = "self" | "opponent";
const CONTACT_MOTIONS = new Set<FightMotion>([FIGHT_MOTIONS.SLASH, FIGHT_MOTIONS.RAPID, FIGHT_MOTIONS.HEAVY, FIGHT_MOTIONS.BITE, FIGHT_MOTIONS.CLAW, FIGHT_MOTIONS.PIERCE, FIGHT_MOTIONS.QUAKE]);
const STILL_FRAMES = [0, 0, 0, 0, 0, 0];

export function isHeavyMotion(motion: FightMotion | undefined): boolean {
	return motion === FIGHT_MOTIONS.HEAVY || motion === FIGHT_MOTIONS.QUAKE;
}

function actionMotionFrames(cue: FightCue | undefined, side: FightSide): number[] {
	if (!cue) return STILL_FRAMES;
	if (side === cue.target && cue.target !== cue.actor) {
		return cue.missed ? [0, 0, -10, -10, -3, 0] : [0, 0, -10, 6, -3, 0];
	}
	if (cue.periodic || side !== cue.actor) return STILL_FRAMES;
	return CONTACT_MOTIONS.has(cue.motion) ? [0, -4, 12, 5, -2, 0] : STILL_FRAMES;
}

export function fighterMotionFrames(cue: FightCue | undefined, side: FightSide): number[] {
	const direction = side === "self" ? 1 : -1;
	return actionMotionFrames(cue, side).map(value => value * direction);
}

export function fighterScaleFrames(cue: FightCue | undefined, side: FightSide): number[] {
	if (!isHeavyMotion(cue?.motion)) return [1, 1, 1, 1, 1, 1];
	return cue?.target === side ? [1, 1, 0.95, 1.03, 0.99, 1] : [1, 1, 1, 1, 1, 1];
}

const MOTION_ACTIONS = {
	slash: ["simpleAttack", "intenseAttack", "sabotageAttack", "stealWeapon", "useTool"],
	rapid: ["quickAttack", "fatalFlight", "goesWild"],
	heavy: ["heavyAttack", "powerfulAttack", "clubSmashAttack", "chargingAttack", "ramAttack", "slamAttack", "grabAndThrowAttack", "petCharge", "petSmallCharge", "petHit", "crush", "horn", "revenge", "shieldAttack", "tailWhipAttack", "tentacleBlowAttack"],
	pierce: ["piercingAttack", "aerialDiveAttack", "peck"],
	bite: ["aceratedFangs", "hardBiteAttack", "familyMealAttack", "bite", "smallBite", "pinch", "swallow"],
	claw: ["clawAttack", "claws", "smallClaws", "petMakeBleed"],
	shot: ["canonAttack", "boulderTossAttack", "inkJet", "spit", "spitInk", "mudShotAttack", "webShotAttack", "createBomb"],
	return: ["boomerangAttack"],
	flame: ["fireAttack", "eruptionAttack", "lavaWaveAttack", "heatMudAttack", "spitFire", "burned"],
	frost: ["blizzardRageAttack", "glacialBreathAttack", "frozenKissAttack", "icySeductionAttack", "startPolarEmbraceAttack", "isStuckInPolarEmbrace", "snowBall", "frozen", "crystalShardAttack"],
	lightning: ["celestialLightning", "lightRayAttack", "divineAttack", "radiantBlastAttack", "paralyzed", "meduseParalyze"],
	wave: ["callOfTheSea", "deluge", "maelstromAttack", "tidalWave", "waterJet", "wateryGust", "drowning", "soaked", "submerged"],
	poison: ["poisonousAttack", "petPoison", "poisonousBite", "poisoned", "blackCorrosion"],
	shield: ["defenseBuff", "protection", "tentacleShield", "rockShieldAttack", "solidification", "stoneSkinAttack", "crystallineArmorAttack", "boostDefense", "buildBarrage", "fishProtectAgainstFire", "protectAgainstCold", "protected"],
	blessing: ["benediction", "concentration", "concentrated", "boostSpeed", "rainbowPower", "outrageAttack", "outrage"],
	heal: ["hydraulicHeal", "magmaBathAttack", "fairyHeal", "healEveryone", "healOwnerInEnergyRange", "smallRegen", "unBlind", "full"],
	rest: ["resting", "helpBreathe", "outOfBreath", "none", "sleeping", "rest"],
	charge: ["chargeChargeMaelstromAttack", "chargeChargeRadiantBlastAttack", "chargeClubSmashAttack", "chargeDeluge", "chargeMaelstromAttack", "chargeRadiantBlastAttack", "chargeUltimateAttack", "chargeChargingAttack"],
	curse: ["abyssalAura", "cursedAttack", "cursedOfTheSea", "darkAttack", "mutiny", "spectralRevengeAttack", "cursed", "cursedByTheSea", "petCurse", "petrificationAttack", "petPetrified", "petrified"],
	drain: ["energeticAttack", "heatDrainAttack", "breathTakingAttack", "vampirism", "sepulcralHunger"],
	roar: ["hellishScream", "roarAttack", "howlAttack", "sing", "scareElephant", "scareFish"],
	summon: ["guildAttack", "summonAttack", "callPack", "packAttack", "alliesArePresent"],
	dodge: ["aqueousEvasion", "ambush", "stealth", "retreat", "slipping"],
	debuff: ["blind", "confused", "dirty", "getDirty", "stunned", "slowed", "swallowed", "targeted", "tetanized", "weak", "bleeding", "breakArmor", "hypnosis", "elephantRememberLastAction", "isUseless", "triesToHelp"],
	quake: ["earthquake", "hammerQuakeAttack", "glacialCaveCollapseAttack", "rageExplosion", "ultimateAttack"],
	mimic: ["counterAttack", "magicMimicAttack", "mimicAttack"]
} as const satisfies Record<FightMotion, readonly string[]>;

export const FIGHT_ACTION_MOTIONS = new Map<string, FightMotion>(
	Object.entries(MOTION_ACTIONS).flatMap(([motion, actions]) => actions.map(action => [action, motion as FightMotion] as const))
);

const SELF_MOTIONS = new Set<FightMotion>([FIGHT_MOTIONS.SHIELD, FIGHT_MOTIONS.BLESSING, FIGHT_MOTIONS.HEAL, FIGHT_MOTIONS.REST, FIGHT_MOTIONS.CHARGE, FIGHT_MOTIONS.DODGE]);
const MISSED_STATUSES = new Set(["missed", "maxUses", "failure", "afraid", "noAction"]);
const ALTERATION_STATUSES = new Set(["new", "active", "stop", "randomAction", "noAction"]);
const MOTION_COLORS: Partial<Record<FightMotion, string>> = {
	flame: "#D96B32", frost: "#3F9CAE", lightning: Theme.colors.gold, wave: Theme.colors.blue,
	poison: "#7A923C", shield: Theme.colors.blue, blessing: Theme.colors.gold, heal: Theme.colors.green,
	rest: Theme.colors.blue, charge: Theme.colors.gold, curse: "#8B6088", drain: Theme.colors.green,
	roar: Theme.colors.gold, summon: Theme.colors.gold, dodge: Theme.colors.muted, debuff: Theme.colors.muted,
	quake: Theme.colors.red, mimic: Theme.colors.blue
};

export type FightImpact = {side: FightSide; kind: "damage" | "energy" | "breath"; amount: number};
export type FightCue = {
	actionId: string; motion: FightMotion; color: string; actor: FightSide; target: FightSide;
	missed: boolean; critical: boolean; periodic: boolean; impacts: FightImpact[];
};

export function fightMotionColor(motion: FightMotion): string {
	return MOTION_COLORS[motion] ?? Theme.colors.red;
}

function effectImpacts(effect: FightEffect | undefined, side: FightSide): FightImpact[] {
	if (!effect) return [];
	const impacts: FightImpact[] = [];
	if (effect.damages) impacts.push({side, kind: "damage", amount: effect.damages});
	if (effect.energy) impacts.push({side, kind: "energy", amount: effect.energy});
	if (effect.breath) impacts.push({side, kind: "breath", amount: effect.breath});
	return impacts;
}

function animationTarget(entry: FightLogEntry, motion: FightMotion, actor: FightSide, periodic: boolean): FightSide {
	const opponent = actor === "self" ? "opponent" : "self";
	if (periodic) return actor;
	if (entry.fightActionEffectDealt?.damages) return opponent;
	if (SELF_MOTIONS.has(motion)) return actor;
	const affectsOpponent = Object.values(entry.fightActionEffectDealt ?? {}).some(Boolean);
	const affectsActor = Object.values(entry.fightActionEffectReceived ?? {}).some(Boolean);
	return affectsActor && !affectsOpponent ? actor : opponent;
}

export function fightCue(entry: FightLogEntry): FightCue {
	const actionId = entry.usedFightActionId ?? entry.fightActionId;
	const motion = entry.status === "charging" ? FIGHT_MOTIONS.CHARGE : FIGHT_ACTION_MOTIONS.get(actionId) ?? FIGHT_MOTIONS.SLASH;
	const actor: FightSide = entry.fighter.isSelf ? "self" : "opponent";
	const opponent: FightSide = entry.fighter.isSelf ? "opponent" : "self";
	const periodic = ALTERATION_STATUSES.has(entry.status ?? "");
	const target = animationTarget(entry, motion, actor, periodic);
	const impacts = [...effectImpacts(entry.fightActionEffectDealt, periodic ? actor : opponent), ...effectImpacts(entry.fightActionEffectReceived, actor)];
	if (entry.fightActionEffectDealt?.reflectedDamages) impacts.push({side: actor, kind: "damage", amount: entry.fightActionEffectDealt.reflectedDamages});
	return {actionId, motion, actor, target, impacts, periodic, color: fightMotionColor(motion), missed: MISSED_STATUSES.has(entry.status ?? ""), critical: entry.status === "critical"};
}