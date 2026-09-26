import {FightCue, FIGHT_MOTIONS, FIGHT_OUTCOMES} from "@/src/display/FightMotion";
import {FightChoreography, FightParticle, FIGHT_PARTICLE_FORMS, FIGHT_TIMING, fightBurst, stillFrames} from "@/src/display/FightEffectPrimitives";
import {Theme} from "@/src/design/Theme";

const FIZZLE: FightChoreography = [
	{id: "failed-preparation", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 42, height: 36, opacity: [0, 0.4, 0.55, 0.2, 0, 0], scale: [0.5, 0.8, 1, 0.5, 0.2, 0], rotation: [0, -12, 12, 28, 40, 40], tint: Theme.colors.faint},
	{id: "failed-spark", form: FIGHT_PARTICLE_FORMS.SPARK, anchor: "actor", width: 18, height: 18, timing: FIGHT_TIMING.SWING, opacity: [0, 0.3, 0.6, 0.2, 0, 0], y: [0, -4, -8, 8, 18, 24], tint: Theme.colors.faint}
];
const PET_REFUSAL: FightChoreography = [
	{id: "pet-hesitation", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 24, height: 16, opacity: [0, 0.4, 0.6, 0.3, 0, 0], x: [14, 16, 18, 20, 22, 24], y: [-18, -20, -22, -24, -26, -28], rotation: stillFrames(-25), tint: Theme.colors.faint},
	{id: "pet-step-back", form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 20, height: 2, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.5, 0.3, 0, 0], x: [0, 0, 8, 14, 18, 20], y: stillFrames(24), tint: Theme.colors.faint}
];
const PREPARATION: FightChoreography = [
	{id: "gathering-ring", form: FIGHT_PARTICLE_FORMS.RING, anchor: "actor", width: 70, height: 70, opacity: [0, 0.5, 0.7, 0.4, 0.1, 0], scale: [1.3, 1.1, 0.9, 0.75, 0.6, 0.5], tint: Theme.colors.gold},
	{id: "gathering-spark", form: FIGHT_PARTICLE_FORMS.SPARK, anchor: "actor", width: 20, height: 20, timing: FIGHT_TIMING.SWING, opacity: [0, 0, 0.5, 0.8, 0.3, 0], y: [0, -6, -14, -22, -28, -32], tint: Theme.colors.gold}
];
const CRITICAL_GLINT: FightChoreography = [
	{id: "critical-cut", form: FIGHT_PARTICLE_FORMS.STREAK, width: 3, height: 86, timing: FIGHT_TIMING.GLIMMER, opacity: [0, 0, 1, 0.7, 0, 0], rotation: stillFrames(35), stretch: {horizontal: [0.3, 0.3, 1, 0.5, 0.1, 0], vertical: [0, 0, 0.6, 1.15, 1.25, 1.3]}, tint: Theme.colors.gold, onHit: true},
	...fightBurst("critical-rays", {radius: 44, size: 2, tint: Theme.colors.gold})
];
const CRITICAL_SIGNATURES: Readonly<Partial<Record<string, FightChoreography>>> = {
	canonAttack: [
		{id: "cannon-critical-pressure", form: FIGHT_PARTICLE_FORMS.ARC, width: 92, height: 100, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.65, 0.1, 0], rotation: stillFrames(90), stretch: {horizontal: [0.1, 0.1, 0.6, 1.1, 1.25, 1.4], vertical: [1, 1, 1, 0.8, 0.5, 0.2]}, tint: Theme.colors.gold, onHit: true},
		...fightBurst("cannon-critical-debris", {radius: 50, size: 5, tint: Theme.colors.ink})
	],
	boomerangAttack: [
		{id: "boomerang-critical-arc", form: FIGHT_PARTICLE_FORMS.ARC, width: 90, height: 60, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.9, 0.6, 0.15, 0], rotation: [-35, -35, 15, 100, 200, 260], scale: [0.2, 0.2, 0.8, 1.15, 0.8, 0.3], tint: Theme.colors.gold, onHit: true}
	],
	sabotageAttack: [
		{id: "sabotage-critical-discharge", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.LIGHTNING, width: 52, height: 52, timing: FIGHT_TIMING.GLIMMER, opacity: [0, 0, 1, 0.65, 0, 0], tint: Theme.colors.blue, onHit: true},
		...fightBurst("sabotage-critical-rivets", {radius: 42, size: 4, tint: Theme.colors.blue})
	]
};
const MISS_LIFT = 26;

function missedParticle(particle: FightParticle): FightParticle {
	if (particle.anchor === "actor" && !particle.travel) return particle;
	const travel = particle.travel ?? stillFrames(1);
	const offsets = particle.y ?? stillFrames(0);
	return {...particle, y: [
		offsets[0] - Math.abs(travel[0]) * MISS_LIFT, offsets[1] - Math.abs(travel[1]) * MISS_LIFT,
		offsets[2] - Math.abs(travel[2]) * MISS_LIFT, offsets[3] - Math.abs(travel[3]) * MISS_LIFT,
		offsets[4] - Math.abs(travel[4]) * MISS_LIFT, offsets[5] - Math.abs(travel[5]) * MISS_LIFT
	]};
}

export function fightOutcomeEffects(cue: FightCue, choreography: FightChoreography): FightChoreography {
	if (cue.outcome === FIGHT_OUTCOMES.FIZZLED) return cue.pet ? PET_REFUSAL : FIZZLE;
	if (cue.outcome === FIGHT_OUTCOMES.PREPARED) return PREPARATION;
	if (cue.outcome === FIGHT_OUTCOMES.MISSED) return choreography.filter(particle => !particle.onHit).map(missedParticle);
	if (cue.critical) return [...choreography, ...CRITICAL_GLINT, ...(CRITICAL_SIGNATURES[cue.actionId] ?? [])];
	return choreography;
}