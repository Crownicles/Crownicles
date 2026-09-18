import {FightCue, FightMotion, FIGHT_MOTIONS} from "@/src/display/FightMotion";
import {FIGHT_PARTICLE_FORMS, FightChoreography, FightFrames} from "@/src/display/FightEffectPrimitives";
import {Theme} from "@/src/design/Theme";
import {FIGHT_ATTACK_SIGNATURES} from "@/src/display/FightAttackSignatures";
import {FIGHT_CAST_PRELUDES, FIGHT_CHARGING_SIGNATURES, FIGHT_PERIODIC_SIGNATURES, FIGHT_SPELL_SIGNATURES} from "@/src/display/FightSpellSignatures";
import {fightOutcomeEffects} from "@/src/display/FightOutcomeEffects";
export {FIGHT_EFFECT_FRAMES, FIGHT_EFFECT_LAYOUT} from "@/src/display/FightEffectPrimitives";

const STRIKE: FightFrames = [0, 0, 1, 0.75, 0, 0];
const FOLLOW_THROUGH: FightFrames = [0, 0, 0, 1, 0.25, 0];
const AFTERGLOW: FightFrames = [0, 0, 0.9, 0.6, 0.2, 0];
const GROW: FightFrames = [0.1, 0.2, 1, 1.15, 1.3, 1.4];
const FLIGHT: FightFrames = [0, 0.85, 1, 0.65, 0, 0];
const OUTBOUND: FightFrames = [0, 0.08, 1, 1, 1, 1];
const HEAVY_SWING_TIMING: FightFrames = [0, 0.2, 0.34, 0.4, 0.58, 1];

const SLASH: FightChoreography = [
	{id: "blade", form: FIGHT_PARTICLE_FORMS.ARC, width: 94, height: 60, opacity: STRIKE, x: [-28, -18, 0, 12, 25, 30], y: [-20, -14, 0, 12, 20, 24], rotation: [-65, -55, -35, -15, 0, 0], scale: GROW},
	{id: "edge", form: FIGHT_PARTICLE_FORMS.STREAK, width: 4, height: 90, opacity: STRIKE, x: [-30, -20, 0, 18, 26, 30], y: [-24, -16, 0, 14, 24, 28], rotation: [32, 32, 32, 32, 32, 32], tint: Theme.colors.paper},
	{id: "crosscut", form: FIGHT_PARTICLE_FORMS.ARC, width: 72, height: 46, opacity: FOLLOW_THROUGH, rotation: [35, 35, 35, 55, 70, 80], scale: GROW}
];

const RAPID: FightChoreography = [
	{id: "opening-cut", form: FIGHT_PARTICLE_FORMS.STREAK, width: 3, height: 70, opacity: [0, 0.7, 0.2, 0, 0, 0], x: [-24, -12, 18, 25, 25, 25], y: [-14, -10, 0, 6, 6, 6], rotation: [55, 55, 55, 55, 55, 55]},
	{id: "return-cut", form: FIGHT_PARTICLE_FORMS.STREAK, width: 4, height: 86, opacity: STRIKE, x: [20, 20, 0, -20, -28, -28], rotation: [-40, -40, -40, -40, -40, -40], tint: Theme.colors.paper},
	{id: "finishing-cut", form: FIGHT_PARTICLE_FORMS.ARC, width: 92, height: 36, opacity: FOLLOW_THROUGH, x: [-24, -24, -12, 8, 28, 32], y: [12, 12, 12, 0, -10, -12], rotation: [-20, -20, -20, -20, -20, -20]},
	{id: "speed-trail", form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 62, height: 2, opacity: STRIKE, travel: [0, 0.05, 0.65, 0.9, 1, 1], y: [-18, -18, -18, -18, -18, -18]}
];

const HEAVY: FightChoreography = [
	{id: "raised-weapon", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.HEAVY, anchor: "actor", width: 44, height: 44, timing: HEAVY_SWING_TIMING, opacity: [0, 1, 1, 1, 0, 0], travel: [0, 0, 0.25, 1, 1, 1], y: [-12, -32, -34, 0, 18, 24], rotation: [-35, -70, -50, 35, 65, 65], scale: [0.6, 1, 1.05, 1.15, 0.5, 0]},
	{id: "downward-impact", form: FIGHT_PARTICLE_FORMS.STREAK, width: 9, height: 100, timing: HEAVY_SWING_TIMING, opacity: [0, 0, 0, 1, 0.1, 0], y: [-38, -38, -38, 0, 16, 28], rotation: [-24, -24, -24, -24, -24, -24], scale: [0.1, 0.1, 0.1, 1.15, 0.65, 0.1]},
	{id: "shockwave", form: FIGHT_PARTICLE_FORMS.RING, width: 84, height: 32, timing: [0, 0.39, 0.4, 0.49, 0.7, 1], opacity: [0, 0, 0.9, 0.6, 0.15, 0], y: [30, 30, 30, 30, 30, 30], scale: [0.1, 0.1, 0.3, 1, 1.35, 1.55], onHit: true},
	{id: "impact-core", form: FIGHT_PARTICLE_FORMS.SPARK, width: 42, height: 42, timing: [0, 0.39, 0.4, 0.44, 0.56, 1], opacity: [0, 0, 1, 0.8, 0, 0], scale: [0, 0, 1.2, 0.9, 0.2, 0], tint: Theme.colors.paper, onHit: true}
];

const PIERCE: FightChoreography = [
	{id: "thrust", form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 92, height: 4, opacity: STRIKE, travel: [0, 0.05, 0.92, 1.1, 1.15, 1.15], scale: [0.15, 0.35, 1, 0.65, 0.2, 0]},
	{id: "point", form: FIGHT_PARTICLE_FORMS.SHARD, anchor: "actor", width: 20, height: 8, opacity: STRIKE, travel: [0, 0.1, 1, 1.16, 1.18, 1.18], rotation: [0, 0, 0, 0, 0, 0], tint: Theme.colors.paper},
	{id: "entry-ring", form: FIGHT_PARTICLE_FORMS.RING, width: 24, height: 58, opacity: AFTERGLOW, scale: GROW, onHit: true}
];

const CLAW: FightChoreography = [
	{id: "upper-claw", form: FIGHT_PARTICLE_FORMS.ARC, width: 76, height: 28, opacity: STRIKE, x: [-14, -14, -9, 8, 20, 24], y: [-12, -12, -12, -8, -6, -6], rotation: [38, 38, 38, 38, 38, 38]},
	{id: "middle-claw", form: FIGHT_PARTICLE_FORMS.ARC, width: 82, height: 28, opacity: [0, 0, 0.8, 0.95, 0.1, 0], x: [-12, -12, 0, 12, 26, 30], rotation: [38, 38, 38, 38, 38, 38]},
	{id: "lower-claw", form: FIGHT_PARTICLE_FORMS.ARC, width: 76, height: 28, opacity: FOLLOW_THROUGH, x: [-8, -8, 6, 18, 30, 34], y: [12, 12, 12, 16, 18, 18], rotation: [38, 38, 38, 38, 38, 38]}
];

const BITE: FightChoreography = [
	{id: "upper-fang", form: FIGHT_PARTICLE_FORMS.SHARD, width: 13, height: 34, opacity: STRIKE, x: [-15, -15, -12, -12, -12, -12], y: [-30, -26, -7, -12, -18, -22], rotation: [-12, -12, -12, -12, -12, -12]},
	{id: "lower-fang", form: FIGHT_PARTICLE_FORMS.SHARD, width: 13, height: 34, opacity: STRIKE, x: [15, 15, 12, 12, 12, 12], y: [30, 26, 7, 12, 18, 22], rotation: [12, 12, 12, 12, 12, 12]},
	{id: "jaw", form: FIGHT_PARTICLE_FORMS.ARC, width: 70, height: 54, opacity: AFTERGLOW, scale: [1.3, 1.2, 0.65, 0.8, 0.95, 1], rotation: [180, 180, 180, 180, 180, 180], onHit: true}
];

const SHOT: FightChoreography = [
	{id: "projectile", form: FIGHT_PARTICLE_FORMS.GLYPH, anchor: "actor", width: 36, height: 36, opacity: FLIGHT, travel: OUTBOUND, y: [8, -12, 0, 10, 14, 14], rotation: [-15, 0, 40, 60, 60, 60], scale: [0.45, 0.85, 1, 0.9, 0.5, 0]},
	{id: "projectile-wake", form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 56, height: 3, opacity: STRIKE, travel: [0, 0, 0.72, 0.98, 1, 1], x: [-22, -22, -22, -22, -22, -22]},
	{id: "projectile-fragment", form: FIGHT_PARTICLE_FORMS.SHARD, width: 8, height: 12, opacity: AFTERGLOW, x: [0, 0, 0, 20, 30, 36], y: [0, 0, 0, -22, -8, 16], rotation: [0, 0, 15, 90, 160, 220], onHit: true}
];

const RETURN: FightChoreography = [
	{id: "boomerang", form: FIGHT_PARTICLE_FORMS.GLYPH, anchor: "actor", width: 40, height: 40, opacity: [0, 0.9, 1, 1, 0.8, 0], travel: [0, 0.1, 1, 0.78, 0.2, 0], y: [0, -25, 0, 22, 18, 0], rotation: [0, 100, 240, 340, 460, 580]},
	{id: "outward-arc", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 52, height: 18, opacity: FLIGHT, travel: [0, 0.05, 0.85, 1, 1, 1], y: [-4, -18, -8, 0, 0, 0], rotation: [-20, -20, 0, 15, 15, 15]},
	{id: "returning-arc", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 52, height: 18, opacity: [0, 0, 0, 0.85, 0.4, 0], travel: [1, 1, 1, 0.8, 0.25, 0], y: [8, 8, 8, 22, 18, 0], rotation: [180, 180, 180, 170, 160, 160]}
];

const FLAME: FightChoreography = [
	{id: "fireball", form: FIGHT_PARTICLE_FORMS.GLYPH, anchor: "actor", width: 44, height: 44, opacity: FLIGHT, travel: OUTBOUND, y: [0, -8, 0, -4, -16, -24], scale: [0.35, 0.8, 1.2, 1.1, 0.6, 0]},
	{id: "flame-tail", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 66, height: 24, opacity: FLIGHT, travel: [0, 0, 0.8, 1, 1, 1], x: [-16, -16, -16, -16, -16, -16], rotation: [-15, -15, -15, -15, -15, -15]},
	{id: "upper-ember", form: FIGHT_PARTICLE_FORMS.MOTE, width: 7, height: 7, opacity: AFTERGLOW, x: [0, 0, -6, -22, -28, -34], y: [0, 0, -4, -18, -34, -44], scale: [0, 0, 1, 0.9, 0.5, 0], onHit: true},
	{id: "outer-ember", form: FIGHT_PARTICLE_FORMS.MOTE, width: 5, height: 5, opacity: FOLLOW_THROUGH, x: [0, 0, 10, 24, 36, 40], y: [0, 0, 2, -8, -24, -34], onHit: true},
	{id: "heat-ripple", form: FIGHT_PARTICLE_FORMS.RING, width: 62, height: 56, opacity: AFTERGLOW, scale: GROW, onHit: true}
];

const FROST: FightChoreography = [
	{id: "ice-lance", form: FIGHT_PARTICLE_FORMS.SHARD, anchor: "actor", width: 40, height: 8, opacity: FLIGHT, travel: OUTBOUND, rotation: [-10, -5, 0, 20, 50, 90]},
	{id: "upper-crystal", form: FIGHT_PARTICLE_FORMS.SHARD, anchor: "actor", width: 26, height: 6, opacity: FLIGHT, travel: [0, 0.05, 0.94, 1, 1, 1], y: [-22, -16, -5, -20, -28, -32], rotation: [18, 18, 18, -30, -60, -90]},
	{id: "lower-crystal", form: FIGHT_PARTICLE_FORMS.SHARD, anchor: "actor", width: 26, height: 6, opacity: STRIKE, travel: [0, 0, 0.9, 1, 1, 1], y: [22, 16, 5, 20, 28, 32], rotation: [-18, -18, -18, 30, 60, 90]},
	{id: "frost-bloom", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 56, height: 56, opacity: AFTERGLOW, rotation: [0, 0, 0, 18, 36, 54], scale: GROW, onHit: true}
];

const LIGHTNING: FightChoreography = [
	{id: "bolt-crown", form: FIGHT_PARTICLE_FORMS.STREAK, width: 5, height: 38, opacity: [0, 0.25, 1, 0, 0.4, 0], x: [9, 9, 9, 9, 9, 9], y: [-31, -31, -31, -31, -31, -31], rotation: [25, 25, 25, 25, 25, 25]},
	{id: "bolt-joint", form: FIGHT_PARTICLE_FORMS.STREAK, width: 5, height: 25, opacity: [0, 0, 1, 0.3, 0, 0], x: [4, 4, 4, 4, 4, 4], y: [-7, -7, -7, -7, -7, -7], rotation: [-48, -48, -48, -48, -48, -48]},
	{id: "bolt-tip", form: FIGHT_PARTICLE_FORMS.STREAK, width: 4, height: 36, opacity: [0, 0, 1, 0.15, 0.4, 0], x: [0, 0, 0, 0, 0, 0], y: [15, 15, 15, 15, 15, 15], rotation: [28, 28, 28, 28, 28, 28]},
	{id: "electric-branch", form: FIGHT_PARTICLE_FORMS.STREAK, width: 2, height: 32, opacity: STRIKE, x: [-15, -15, -15, -15, -15, -15], y: [4, 4, 4, 4, 4, 4], rotation: [-60, -60, -60, -60, -60, -60]},
	{id: "electric-flare", form: FIGHT_PARTICLE_FORMS.SPARK, width: 42, height: 42, opacity: AFTERGLOW, scale: GROW, onHit: true}
];

const WAVE: FightChoreography = [
	{id: "wave-front", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 70, height: 54, opacity: FLIGHT, travel: OUTBOUND, rotation: [85, 85, 85, 85, 85, 85], scale: [0.35, 0.65, 1.1, 1.15, 1.2, 1.25]},
	{id: "wave-crest", form: FIGHT_PARTICLE_FORMS.GLYPH, anchor: "actor", width: 44, height: 44, opacity: FLIGHT, travel: [0, 0.02, 0.88, 1, 1, 1], y: [8, 4, 0, 4, 10, 14]},
	{id: "wave-wake", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 56, height: 24, opacity: [0, 0.2, 0.75, 0.4, 0, 0], travel: [0, 0, 0.62, 0.95, 1, 1], y: [18, 18, 18, 18, 18, 18]},
	{id: "water-splash", form: FIGHT_PARTICLE_FORMS.RING, width: 82, height: 24, opacity: AFTERGLOW, y: [24, 24, 24, 24, 24, 24], scale: GROW, onHit: true}
];

const POISON: FightChoreography = [
	{id: "venom-drop", form: FIGHT_PARTICLE_FORMS.GLYPH, anchor: "actor", width: 32, height: 32, opacity: FLIGHT, travel: OUTBOUND, y: [0, -22, 0, 16, 22, 26], rotation: [-20, 0, 25, 35, 35, 35]},
	{id: "venom-trail", form: FIGHT_PARTICLE_FORMS.MOTE, anchor: "actor", width: 8, height: 11, opacity: FLIGHT, travel: [0, 0, 0.8, 1, 1, 1], y: [0, -20, -8, 14, 24, 28]},
	{id: "venom-splash", form: FIGHT_PARTICLE_FORMS.MOTE, width: 7, height: 10, opacity: AFTERGLOW, x: [0, 0, 0, 20, 28, 30], y: [0, 0, 0, -14, 8, 26], onHit: true},
	{id: "venom-pool", form: FIGHT_PARTICLE_FORMS.RING, width: 68, height: 16, opacity: AFTERGLOW, y: [32, 32, 32, 32, 32, 32], scale: GROW, onHit: true}
];

const DRAIN: FightChoreography = [
	{id: "drain-grasp", form: FIGHT_PARTICLE_FORMS.ARC, width: 62, height: 56, opacity: FLIGHT, scale: [1.2, 1, 0.75, 0.6, 0.3, 0]},
	{id: "returning-energy", form: FIGHT_PARTICLE_FORMS.MOTE, width: 10, height: 10, opacity: [0, 0, 1, 0.9, 0.7, 0], travel: [0, 0, 0, -0.4, -0.85, -1], y: [0, 0, 0, -16, -10, 0], onHit: true},
	{id: "returning-spark", form: FIGHT_PARTICLE_FORMS.SPARK, width: 22, height: 22, opacity: [0, 0, 0.7, 1, 0.6, 0], travel: [0, 0, 0, -0.28, -0.75, -1], y: [0, 0, 12, 18, 10, 0], onHit: true},
	{id: "restored-energy", form: FIGHT_PARTICLE_FORMS.RING, anchor: "actor", width: 62, height: 62, opacity: [0, 0, 0, 0, 0.6, 0], scale: [0.4, 0.4, 0.4, 0.4, 1, 1.2], onHit: true}
];

const SHIELD: FightChoreography = [
	{id: "shield-face", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 50, height: 50, opacity: [0, 0.6, 1, 1, 0.5, 0], y: [24, 12, 0, 0, -2, -4], scale: [0.4, 0.8, 1.08, 1, 1, 1]},
	{id: "shield-barrier", form: FIGHT_PARTICLE_FORMS.ARC, width: 80, height: 92, opacity: FLIGHT, rotation: [90, 90, 90, 90, 90, 90], scale: [0.5, 0.8, 1, 1.05, 1.1, 1.1]},
	{id: "shield-base", form: FIGHT_PARTICLE_FORMS.RING, width: 76, height: 18, opacity: AFTERGLOW, y: [34, 34, 34, 34, 34, 34], scale: GROW}
];

const BLESSING: FightChoreography = [
	{id: "blessing-column", form: FIGHT_PARTICLE_FORMS.STREAK, width: 3, height: 88, opacity: [0, 0.3, 0.7, 0.45, 0.1, 0], y: [18, 8, -6, -16, -28, -36], scale: [0.3, 0.6, 1, 1, 0.8, 0.5]},
	{id: "blessing-left", form: FIGHT_PARTICLE_FORMS.SPARK, width: 22, height: 22, opacity: FLIGHT, x: [-22, -22, -22, -22, -22, -22], y: [28, 20, 0, -16, -32, -42]},
	{id: "blessing-right", form: FIGHT_PARTICLE_FORMS.SPARK, width: 18, height: 18, opacity: [0, 0, 0.7, 1, 0.5, 0], x: [22, 22, 22, 22, 22, 22], y: [32, 26, 14, -6, -22, -36]},
	{id: "blessing-crown", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 40, height: 40, opacity: AFTERGLOW, y: [8, 8, 0, -8, -18, -28], scale: GROW}
];

const HEAL: FightChoreography = [
	{id: "healing-heart", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 38, height: 38, opacity: FLIGHT, scale: [0.5, 0.8, 1.15, 0.95, 1.1, 0.8], y: [8, 4, 0, -4, -10, -16]},
	{id: "healing-rise", form: FIGHT_PARTICLE_FORMS.RING, width: 70, height: 24, opacity: [0, 0.4, 0.7, 0.6, 0.2, 0], y: [28, 20, 6, -6, -20, -34], scale: [0.6, 0.8, 1, 1, 0.9, 0.75]},
	{id: "healing-afterglow", form: FIGHT_PARTICLE_FORMS.RING, width: 62, height: 20, opacity: [0, 0, 0, 0.6, 0.4, 0], y: [34, 34, 24, 14, 0, -18], scale: GROW}
];

const REST: FightChoreography = [
	{id: "breath-in", form: FIGHT_PARTICLE_FORMS.ARC, width: 54, height: 14, opacity: [0, 0.3, 0.6, 0.35, 0, 0], x: [-18, -12, 0, 10, 18, 24], y: [14, 10, 2, -4, -8, -12], scale: [0.7, 0.85, 1.1, 1.15, 1.2, 1.2]},
	{id: "breath-out", form: FIGHT_PARTICLE_FORMS.ARC, width: 64, height: 16, opacity: [0, 0, 0.25, 0.6, 0.25, 0], x: [-14, -14, -8, 4, 16, 24], y: [24, 24, 16, 6, -2, -8], scale: [0.7, 0.7, 0.8, 1, 1.1, 1.15]},
	{id: "breath-trace", form: FIGHT_PARTICLE_FORMS.ARC, width: 38, height: 10, opacity: [0, 0.2, 0.4, 0.2, 0, 0], x: [-12, -6, 6, 18, 24, 28], y: [-2, -6, -12, -18, -22, -26]}
];

const CHARGE: FightChoreography = [
	{id: "charge-circle", form: FIGHT_PARTICLE_FORMS.RING, width: 72, height: 72, opacity: [0, 0.4, 0.7, 0.8, 0.9, 0], scale: [1.25, 1.1, 0.9, 0.7, 0.5, 0.2]},
	{id: "charge-left", form: FIGHT_PARTICLE_FORMS.SHARD, width: 22, height: 5, opacity: FLIGHT, x: [-40, -32, -18, -8, 0, 0], y: [-18, -14, -8, -4, 0, 0], rotation: [25, 25, 25, 25, 25, 25]},
	{id: "charge-right", form: FIGHT_PARTICLE_FORMS.SHARD, width: 22, height: 5, opacity: FLIGHT, x: [40, 32, 18, 8, 0, 0], y: [18, 14, 8, 4, 0, 0], rotation: [25, 25, 25, 25, 25, 25]},
	{id: "charge-core", form: FIGHT_PARTICLE_FORMS.SPARK, width: 36, height: 36, opacity: [0, 0.2, 0.4, 0.8, 1, 0], scale: [0.2, 0.35, 0.55, 0.8, 1.1, 0.5]}
];

const CURSE: FightChoreography = [
	{id: "curse-seal", form: FIGHT_PARTICLE_FORMS.RING, width: 70, height: 70, opacity: FLIGHT, scale: [1.3, 1.1, 0.75, 0.85, 0.9, 1]},
	{id: "curse-mark", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 42, height: 42, opacity: FLIGHT, y: [-32, -16, 0, 4, 10, 16], rotation: [-12, -6, 0, 4, 8, 12]},
	{id: "curse-shackle", form: FIGHT_PARTICLE_FORMS.ARC, width: 64, height: 34, opacity: AFTERGLOW, rotation: [0, 30, 80, 140, 200, 240], scale: [1.2, 1.1, 0.8, 0.7, 0.6, 0.5]}
];

const ROAR: FightChoreography = [
	{id: "sound-front", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 50, height: 66, opacity: FLIGHT, travel: OUTBOUND, rotation: [90, 90, 90, 90, 90, 90], scale: GROW},
	{id: "sound-middle", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 40, height: 54, opacity: STRIKE, travel: [0, 0, 0.65, 0.9, 1, 1], rotation: [90, 90, 90, 90, 90, 90], scale: GROW},
	{id: "sound-echo", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 30, height: 42, opacity: [0, 0, 0.5, 0.7, 0.15, 0], travel: [0, 0, 0.3, 0.7, 0.95, 1], rotation: [90, 90, 90, 90, 90, 90], scale: GROW}
];

const SUMMON: FightChoreography = [
	{id: "summon-first", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 24, height: 24, opacity: FLIGHT, x: [-40, -30, -12, -6, 0, 4], y: [-28, -20, -8, 0, 8, 14], rotation: [-30, -30, -30, -30, -30, -30]},
	{id: "summon-second", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 28, height: 28, opacity: STRIKE, x: [0, 0, 0, 0, 0, 0], y: [-46, -32, -2, 8, 16, 20]},
	{id: "summon-third", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 24, height: 24, opacity: FOLLOW_THROUGH, x: [40, 40, 30, 12, 6, 0], y: [-28, -28, -20, -8, 0, 8], rotation: [30, 30, 30, 30, 30, 30]}
];

const DODGE: FightChoreography = [
	{id: "evasion-afterimage", form: FIGHT_PARTICLE_FORMS.ARC, width: 42, height: 62, opacity: [0, 0.3, 0.45, 0.2, 0, 0], x: [0, -4, -14, -22, -28, -30], rotation: [-12, -12, -12, -12, -12, -12]},
	{id: "evasion-wake", form: FIGHT_PARTICLE_FORMS.STREAK, width: 56, height: 2, opacity: STRIKE, x: [0, 4, 16, 22, 28, 30], y: [8, 8, 8, 8, 8, 8]},
	{id: "evasion-upper-wake", form: FIGHT_PARTICLE_FORMS.STREAK, width: 38, height: 2, opacity: FLIGHT, x: [0, 2, 12, 18, 24, 28], y: [-12, -12, -12, -12, -12, -12]}
];

const DEBUFF: FightChoreography = [
	{id: "status-mark", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 32, height: 32, opacity: FLIGHT, y: [-22, -12, -4, -8, -16, -24], rotation: [-12, 12, -12, 8, -4, 0]},
	{id: "status-orbit", form: FIGHT_PARTICLE_FORMS.ARC, width: 62, height: 26, opacity: FLIGHT, y: [-18, -18, -18, -18, -18, -18], rotation: [-20, 0, 30, 60, 90, 120]},
	{id: "status-fall", form: FIGHT_PARTICLE_FORMS.MOTE, width: 5, height: 5, opacity: AFTERGLOW, x: [0, 0, 18, 24, 28, 30], y: [-18, -18, -14, 0, 16, 28]}
];

const QUAKE: FightChoreography = [
	{id: "ground-shock", form: FIGHT_PARTICLE_FORMS.RING, width: 90, height: 26, opacity: AFTERGLOW, y: [28, 28, 28, 28, 28, 28], scale: GROW, onHit: true},
	{id: "ground-echo", form: FIGHT_PARTICLE_FORMS.RING, width: 76, height: 20, opacity: FOLLOW_THROUGH, y: [30, 30, 30, 30, 30, 30], scale: GROW, onHit: true},
	{id: "ground-crack-left", form: FIGHT_PARTICLE_FORMS.STREAK, width: 3, height: 38, opacity: STRIKE, x: [-18, -18, -18, -18, -18, -18], y: [22, 22, 22, 22, 22, 22], rotation: [-55, -55, -55, -55, -55, -55]},
	{id: "ground-crack-right", form: FIGHT_PARTICLE_FORMS.STREAK, width: 3, height: 38, opacity: STRIKE, x: [18, 18, 18, 18, 18, 18], y: [22, 22, 22, 22, 22, 22], rotation: [55, 55, 55, 55, 55, 55]},
	{id: "lifted-stone", form: FIGHT_PARTICLE_FORMS.SHARD, width: 10, height: 12, opacity: AFTERGLOW, x: [0, 0, -16, -25, -30, -34], y: [28, 28, 16, -10, 8, 30], rotation: [0, 0, 30, 80, 140, 200], onHit: true}
];

const MIMIC: FightChoreography = [
	{id: "mirror-first", form: FIGHT_PARTICLE_FORMS.ARC, width: 62, height: 46, opacity: FLIGHT, rotation: [-45, -30, 0, 30, 60, 90], scale: GROW},
	{id: "mirror-second", form: FIGHT_PARTICLE_FORMS.ARC, width: 62, height: 46, opacity: STRIKE, rotation: [135, 150, 180, 210, 240, 270], scale: GROW},
	{id: "mirror-spark", form: FIGHT_PARTICLE_FORMS.SPARK, width: 34, height: 34, opacity: AFTERGLOW, scale: GROW}
];

const PERIODIC: FightChoreography = [
	{id: "periodic-mark", form: FIGHT_PARTICLE_FORMS.GLYPH, width: 30, height: 30, opacity: FLIGHT, y: [8, 4, 0, -4, -12, -20], scale: [0.6, 0.8, 1, 1, 0.85, 0.6]},
	{id: "periodic-mote", form: FIGHT_PARTICLE_FORMS.MOTE, width: 6, height: 6, opacity: AFTERGLOW, x: [-18, -18, -18, -20, -24, -26], y: [14, 14, 8, -2, -14, -22]}
];

const CHOREOGRAPHIES = {
	slash: SLASH, rapid: RAPID, heavy: HEAVY, pierce: PIERCE, bite: BITE, claw: CLAW,
	shot: SHOT, return: RETURN, flame: FLAME, frost: FROST, lightning: LIGHTNING, wave: WAVE, poison: POISON, drain: DRAIN,
	shield: SHIELD, blessing: BLESSING, heal: HEAL, rest: REST, charge: CHARGE, curse: CURSE,
	roar: ROAR, summon: SUMMON, dodge: DODGE, debuff: DEBUFF, quake: QUAKE, mimic: MIMIC
} satisfies Record<FightMotion, FightChoreography>;

const ACTION_CHOREOGRAPHIES: Readonly<Partial<Record<string, FightChoreography>>> = {
	poisonousBite: [...BITE, ...POISON.filter(particle => particle.onHit)],
	...FIGHT_ATTACK_SIGNATURES,
	...FIGHT_SPELL_SIGNATURES
};

function actionChoreography(cue: FightCue): FightChoreography {
	if (cue.periodic) return FIGHT_PERIODIC_SIGNATURES[cue.actionId] ?? PERIODIC;
	if (cue.motion === FIGHT_MOTIONS.CHARGE) return FIGHT_CHARGING_SIGNATURES[cue.actionId] ?? CHARGE;
	return ACTION_CHOREOGRAPHIES[cue.actionId] ?? CHOREOGRAPHIES[cue.motion];
}

export function fightChoreography(cue: FightCue): FightChoreography {
	return fightOutcomeEffects(cue, [...(FIGHT_CAST_PRELUDES[cue.sourceActionId] ?? []), ...actionChoreography(cue)]);
}