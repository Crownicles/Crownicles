import {FightCue, FightMotion, FightSide} from "@/src/display/FightMotion";
import {FIGHT_TIMING, FightFrames, stillFrames} from "@/src/display/FightEffectPrimitives";

type FighterPose = {horizontal: FightFrames; vertical: FightFrames; scale: FightFrames; rotation: FightFrames; timing: FightFrames};
const STILL_POSE: FighterPose = {horizontal: stillFrames(0), vertical: stillFrames(0), scale: stillFrames(1), rotation: stillFrames(0), timing: FIGHT_TIMING.SWING};
const MELEE_POSE: FighterPose = {...STILL_POSE, horizontal: [0, -6, -4, 26, 8, 0], rotation: [0, -4, -5, 8, 2, 0]};
const HEAVY_POSE: FighterPose = {...MELEE_POSE, horizontal: [0, -8, -10, 30, 10, 0], vertical: [0, -3, -6, 4, 0, 0], rotation: [0, -8, -12, 10, 3, 0]};
const RAM_POSE: FighterPose = {...MELEE_POSE, horizontal: [0, -10, -14, 38, 12, 0], rotation: [0, -3, -6, 16, 4, 0]};
const DIVE_POSE: FighterPose = {...MELEE_POSE, horizontal: [0, 0, 10, 32, 10, 0], vertical: [0, -24, -34, 3, 4, 0], rotation: [0, -8, 6, 14, 2, 0]};
const REST_POSE: FighterPose = {...STILL_POSE, timing: [0, 0.18, 0.4, 0.56, 0.78, 1], scale: [1, 1.025, 1.05, 1.035, 1.01, 1], vertical: [0, -1, -3, -2, -1, 0]};
const HIT_POSE: FighterPose = {...STILL_POSE, timing: FIGHT_TIMING.IMPACT, horizontal: [0, 0, -12, 5, -2, 0], rotation: [0, 0, -9, 4, -1, 0], scale: [1, 1, 0.94, 1.025, 1, 1]};
const HEAVY_HIT: FighterPose = {...HIT_POSE, horizontal: [0, 0, -22, 8, -3, 0], rotation: [0, 0, -16, 7, -2, 0], scale: [1, 1, 0.85, 1.06, 0.98, 1]};
const MISSED_POSE: FighterPose = {...STILL_POSE, timing: [0, 0.24, 0.34, 0.4, 0.65, 1], horizontal: [0, 0, -16, -20, -10, 0], rotation: [0, 0, -10, -12, -4, 0]};

const ACTOR_POSES: Partial<Record<FightMotion, FighterPose>> = {
	slash: MELEE_POSE, heavy: HEAVY_POSE, bite: {...MELEE_POSE, horizontal: [0, -3, -5, 20, 6, 0]},
	rapid: {...MELEE_POSE, timing: [0, 0.3, 0.4, 0.46, 0.54, 1], horizontal: [0, -3, 24, 8, 20, 0], rotation: [0, -4, 7, -3, 5, 0]},
	pierce: {...MELEE_POSE, horizontal: [0, -5, -8, 34, 6, 0], rotation: [0, -2, -4, 10, 1, 0]},
	claw: {...MELEE_POSE, horizontal: [0, -5, -3, 22, 10, 0], rotation: [0, -6, -8, 12, -4, 0]},
	quake: {...HEAVY_POSE, horizontal: stillFrames(0), vertical: [0, -4, -12, 5, 2, 0]},
	dodge: MISSED_POSE, rest: REST_POSE, heal: REST_POSE, blessing: {...REST_POSE, vertical: [0, -2, -4, -6, -3, 0]},
	charge: {...STILL_POSE, scale: [1, 0.98, 0.96, 0.95, 1.02, 1]},
	shield: {...STILL_POSE, horizontal: [0, -2, -3, 3, 1, 0], rotation: [0, -2, -4, -2, 0, 0]},
	shot: {...STILL_POSE, timing: [0, 0.2, 0.28, 0.4, 0.64, 1], horizontal: [0, -3, 8, -4, -1, 0]},
	return: {...MELEE_POSE, timing: [0, 0.18, 0.26, 0.4, 0.82, 1], horizontal: [0, -5, 16, 5, 2, 0], rotation: [0, -8, 12, 3, -2, 0]}
};
const ACTION_POSES: Readonly<Partial<Record<string, FighterPose>>> = {
	canonAttack: {...STILL_POSE, timing: [0, 0.25, 0.28, 0.4, 0.64, 1], horizontal: [0, 0, -18, -8, -2, 0], rotation: [0, 0, -9, -3, -1, 0]},
	shieldAttack: {...RAM_POSE, rotation: [0, -5, -5, 6, 2, 0]}, ramAttack: RAM_POSE, chargingAttack: RAM_POSE,
	petCharge: {...RAM_POSE, horizontal: [0, -4, -6, 22, 6, 0]}, petSmallCharge: MELEE_POSE,
	aerialDiveAttack: DIVE_POSE, fatalFlight: DIVE_POSE, slamAttack: DIVE_POSE,
	grabAndThrowAttack: {...HEAVY_POSE, vertical: [0, -4, -18, 3, 1, 0]},
	stealWeapon: {...STILL_POSE, horizontal: [0, 3, 8, 12, -3, 0], rotation: [0, 0, 5, 8, -2, 0]},
	useTool: {...STILL_POSE, rotation: [0, -3, -6, 8, -3, 0]}, tailWhipAttack: {...MELEE_POSE, rotation: [0, -12, -8, 14, -5, 0]},
	tentacleBlowAttack: {...MELEE_POSE, rotation: [0, -8, -4, 10, -6, 0]}, boulderTossAttack: {...HEAVY_POSE, timing: FIGHT_TIMING.FLIGHT}
};
const REACTION_POSES: Partial<Record<FightMotion, FighterPose>> = {
	heavy: HEAVY_HIT, quake: {...HEAVY_HIT, vertical: [0, 0, -8, 4, 0, 0]},
	frost: {...HIT_POSE, horizontal: [0, 0, -3, -3, -1, 0], rotation: [0, 0, -3, -2, -1, 0]},
	lightning: {...HIT_POSE, horizontal: [0, 0, -4, 3, -2, 0], rotation: [0, 0, -5, 4, -3, 0]},
	wave: {...HIT_POSE, horizontal: [0, 0, -15, -10, -4, 0], rotation: [0, 0, -10, -6, -2, 0]},
	poison: {...HIT_POSE, horizontal: [0, 0, -3, 2, -1, 0], rotation: [0, 0, -5, 4, -2, 0]},
	curse: {...HIT_POSE, horizontal: stillFrames(0), scale: [1, 1, 0.94, 0.94, 0.98, 1]},
	drain: {...HIT_POSE, horizontal: [0, 0, 3, 6, 2, 0]}, shot: HEAVY_HIT
};

const TARGET_ACTION_POSES: Readonly<Partial<Record<string, FighterPose>>> = {
	grabAndThrowAttack: {...HEAVY_HIT, timing: FIGHT_TIMING.SWING, vertical: [0, -8, -30, 4, 2, 0]}
};

function impactPose(cue: FightCue): FighterPose {
	if (cue.missed) return MISSED_POSE;
	return TARGET_ACTION_POSES[cue.actionId] ?? REACTION_POSES[cue.motion] ?? HIT_POSE;
}

function fighterPose(cue: FightCue | undefined, side: FightSide): FighterPose {
	if (!cue || cue.periodic) return STILL_POSE;
	if (cue.actor === side) return ACTION_POSES[cue.actionId] ?? ACTOR_POSES[cue.motion] ?? STILL_POSE;
	return cue.target === side ? impactPose(cue) : STILL_POSE;
}

export function fighterMotionFrames(cue: FightCue | undefined, side: FightSide): number[] {
	const direction = side === "self" ? 1 : -1;
	return fighterPose(cue, side).horizontal.map(value => value * direction);
}

export function fighterScaleFrames(cue: FightCue | undefined, side: FightSide): number[] {
	return [...fighterPose(cue, side).scale];
}

export function fighterLiftFrames(cue: FightCue | undefined, side: FightSide): number[] {
	return [...fighterPose(cue, side).vertical];
}

export function fighterTimingFrames(cue: FightCue | undefined, side: FightSide): number[] {
	return [...fighterPose(cue, side).timing];
}

export function fighterTiltFrames(cue: FightCue | undefined, side: FightSide): string[] {
	const direction = side === "self" ? 1 : -1;
	return fighterPose(cue, side).rotation.map(angle => `${angle * direction}deg`);
}