import {FIGHT_MOTIONS, FightMotion, fightMotionColor} from "@/src/display/FightMotion";
import {FIGHT_EFFECT_LAYOUT, FIGHT_PARTICLE_FORMS, FIGHT_TIMING, FightChoreography, FightParticle, fightBurst, stillFrames} from "@/src/display/FightEffectPrimitives";
import {Theme} from "@/src/design/Theme";

const FIGHTER_SPAN = FIGHT_EFFECT_LAYOUT.anchors.opponent - FIGHT_EFFECT_LAYOUT.anchors.self;
const FIRE_COLOR = fightMotionColor(FIGHT_MOTIONS.FLAME);
const ICE_COLOR = fightMotionColor(FIGHT_MOTIONS.FROST);
const VENOM_COLOR = fightMotionColor(FIGHT_MOTIONS.POISON);
const CURSE_COLOR = fightMotionColor(FIGHT_MOTIONS.CURSE);
const SPIRAL_TRACKS = [
	{id: "outer", width: 86, height: 62, rotation: [-40, -10, 60, 130, 220, 290]},
	{id: "middle", width: 66, height: 48, rotation: [130, 160, 230, 300, 390, 460]},
	{id: "inner", width: 44, height: 34, rotation: [-10, -40, -110, -180, -270, -340]}
] as const;

function spiral(id: string, tint: string): FightChoreography {
	return SPIRAL_TRACKS.map(track => ({
		id: `${id}-${track.id}`, form: FIGHT_PARTICLE_FORMS.ARC, width: track.width, height: track.height,
		opacity: [0, 0.3, 0.9, 0.65, 0.25, 0], rotation: track.rotation, tint,
		scale: [1.15, 1.05, 0.85, 0.65, 0.35, 0.1], y: [8, 4, 0, 0, -4, -8]
	}));
}

type BreathStyle = {glyph: FightMotion; tint: string; spread: number};
const BREATH_TRACKS = [{id: "upper", offset: -1}, {id: "center", offset: 0}, {id: "lower", offset: 1}] as const;

function elementalBreath(id: string, style: BreathStyle): FightChoreography {
	return BREATH_TRACKS.map(track => ({
		id: `${id}-${track.id}`, form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: style.glyph,
		anchor: "actor", width: 30, height: 30, timing: FIGHT_TIMING.FLIGHT,
		opacity: [0, 0, 0.65, 0.9, 0.25, 0], travel: [0, 0, 0.15, 0.9, 1, 1],
		y: [0, 0, track.offset * 4, track.offset * style.spread, track.offset * style.spread, track.offset * style.spread],
		scale: [0.2, 0.2, 0.4, 1.1, 1.2, 0.6], tint: style.tint
	}));
}

function lightBeam(id: string, tint: string): FightChoreography {
	return [
		{id: `${id}-beam`, form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 0, relativeWidth: FIGHTER_SPAN, height: 7, timing: [0, 0.3, 0.36, 0.4, 0.62, 1], opacity: [0, 0, 0.35, 1, 0.4, 0], travel: stillFrames(0.5), stretch: {horizontal: [0, 0, 0.15, 1, 1, 0], vertical: [1, 1, 1, 1.2, 0.3, 0]}, tint},
		{id: `${id}-core`, form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 0, relativeWidth: FIGHTER_SPAN, height: 2, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.8, 0, 0], travel: stillFrames(0.5), tint: Theme.colors.paper},
		...fightBurst(`${id}-refraction`, {radius: 32, size: 2, tint})
	];
}

const FIREBALL: FightChoreography = [
	{id: "fire-kindling", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.FLAME, anchor: "actor", width: 30, height: 30, timing: FIGHT_TIMING.CAST, opacity: [0, 0.6, 1, 0.8, 0, 0], scale: [0.2, 0.6, 1, 0.45, 0.2, 0], tint: FIRE_COLOR},
	{id: "fireball", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.FLAME, anchor: "actor", width: 44, height: 44, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0, 0.8, 1, 0.2, 0], travel: [0, 0, 0.1, 1, 1, 1], y: [0, 0, -8, 0, -18, -30], stretch: {horizontal: [0.4, 0.4, 0.75, 1.3, 0.7, 0.2], vertical: [0.4, 0.4, 0.75, 0.85, 1.3, 0.5]}, tint: FIRE_COLOR},
	{id: "fire-ribbon", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 82, height: 26, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0, 0.25, 0.9, 0.1, 0], travel: [0, 0, 0, 0.78, 1, 1], x: stillFrames(-14), rotation: stillFrames(-12), tint: FIRE_COLOR},
	{id: "heat-ripple", form: FIGHT_PARTICLE_FORMS.RING, width: 60, height: 54, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 0.9, 0.6, 0.15, 0], scale: [0, 0, 0.4, 1.15, 1.4, 1.5], tint: FIRE_COLOR, onHit: true},
	...fightBurst("burning-embers", {radius: 42, size: 3, tint: FIRE_COLOR, form: FIGHT_PARTICLE_FORMS.MOTE})
];
const ERUPTION: FightChoreography = [
	{id: "eruption-fissure", form: FIGHT_PARTICLE_FORMS.ARC, width: 86, height: 14, timing: FIGHT_TIMING.SWING, opacity: [0, 0.2, 0.6, 1, 0.3, 0], y: stillFrames(30), tint: FIRE_COLOR},
	{id: "eruption-column", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.FLAME, width: 44, height: 44, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 1, 0.4, 0], y: [30, 30, 16, -10, -28, -42], stretch: {horizontal: [0.4, 0.4, 0.7, 1, 0.7, 0.3], vertical: [0.1, 0.1, 0.4, 1.5, 1.3, 0.3]}, tint: FIRE_COLOR},
	{id: "eruption-left", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.FLAME, width: 30, height: 30, timing: [0, 0.4, 0.45, 0.52, 0.72, 1], opacity: [0, 0, 0.8, 1, 0.3, 0], x: stillFrames(-28), y: [30, 30, 20, -8, -22, -32], tint: FIRE_COLOR},
	{id: "eruption-right", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.FLAME, width: 28, height: 28, timing: [0, 0.45, 0.5, 0.58, 0.76, 1], opacity: [0, 0, 0.8, 1, 0.3, 0], x: stillFrames(26), y: [30, 30, 20, -6, -20, -32], tint: FIRE_COLOR},
	...fightBurst("eruption-stones", {radius: 44, size: 4, tint: Theme.colors.ink})
];
const FROST_BREATH: FightChoreography = [
	...elementalBreath("frost-breath", {glyph: FIGHT_MOTIONS.FROST, tint: ICE_COLOR, spread: 24}),
	{id: "frost-crust", form: FIGHT_PARTICLE_FORMS.ARC, width: 76, height: 58, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.7, 0.65, 0.3, 0], rotation: [0, 0, 0, 30, 60, 90], scale: [0.2, 0.2, 0.8, 1, 1.1, 1.2], tint: ICE_COLOR, onHit: true},
	...fightBurst("frost-shards", {radius: 36, size: 3, tint: ICE_COLOR})
];
const BLIZZARD: FightChoreography = [
	...spiral("blizzard", ICE_COLOR),
	{id: "blizzard-snowflake", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.FROST, width: 38, height: 38, opacity: [0, 0.2, 1, 0.8, 0.3, 0], rotation: [0, 30, 110, 180, 250, 300], tint: ICE_COLOR},
	{id: "blizzard-needle", form: FIGHT_PARTICLE_FORMS.SHARD, width: 4, height: 34, timing: FIGHT_TIMING.SWING, opacity: [0, 0, 0.5, 1, 0.2, 0], x: [-32, -30, -18, 0, 22, 32], y: [-38, -36, -20, 0, 24, 36], rotation: stillFrames(35), tint: ICE_COLOR},
	...fightBurst("blizzard-snow", {radius: 40, size: 3, tint: ICE_COLOR, form: FIGHT_PARTICLE_FORMS.MOTE})
];
const CRYSTAL: FightChoreography = [
	{id: "crystal-tip", form: FIGHT_PARTICLE_FORMS.SHARD, anchor: "actor", width: 34, height: 18, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.5, 1, 1, 0.2, 0], travel: [0, 0, 0.12, 1, 1.05, 1.05], rotation: [0, 20, 80, 180, 230, 250], tint: ICE_COLOR},
	{id: "crystal-glint", form: FIGHT_PARTICLE_FORMS.SPARK, anchor: "actor", width: 26, height: 26, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.2, 0.8, 1, 0, 0], travel: [0, 0, 0.12, 1, 1.05, 1.05], tint: Theme.colors.paper},
	...fightBurst("crystal-fracture", {radius: 44, size: 5, tint: ICE_COLOR})
];
const FROZEN_KISS: FightChoreography = [
	{id: "frozen-heart", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.HEAL, anchor: "actor", width: 32, height: 32, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.4, 1, 1, 0.2, 0], travel: [0, 0.12, 0.35, 1, 1, 1], y: [4, -12, -20, 0, 6, 12], rotation: [-12, 8, -8, 0, 10, 20], tint: ICE_COLOR},
	...spiral("frozen-embrace", ICE_COLOR)
];

const BOLT_SEGMENTS = [
	{id: "crown", horizontal: 10, vertical: -34, height: 32, angle: 28},
	{id: "joint", horizontal: 7, vertical: -12, height: 22, angle: -54},
	{id: "point", horizontal: 0, vertical: 10, height: 38, angle: 24},
	{id: "branch", horizontal: -18, vertical: -4, height: 26, angle: -60}
] as const;
const LIGHTNING: FightChoreography = [
	...BOLT_SEGMENTS.map((segment): FightParticle => ({id: `lightning-${segment.id}`, form: FIGHT_PARTICLE_FORMS.STREAK, width: 4, height: segment.height, timing: FIGHT_TIMING.GLIMMER, opacity: [0, 0, 1, 0.75, 0, 0], x: stillFrames(segment.horizontal), y: stillFrames(segment.vertical), rotation: stillFrames(segment.angle), tint: Theme.colors.gold})),
	{id: "lightning-afterimage", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.LIGHTNING, width: 48, height: 48, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.6, 0.35, 0.1, 0], scale: [1, 1, 1.15, 0.9, 0.7, 0.2], tint: Theme.colors.gold, onHit: true},
	...fightBurst("electric-arcs", {radius: 36, size: 2, tint: Theme.colors.gold})
];
const DIVINE: FightChoreography = [
	{id: "divine-pillar", form: FIGHT_PARTICLE_FORMS.STREAK, width: 6, height: 122, timing: FIGHT_TIMING.SWING, opacity: [0, 0, 0.3, 1, 0.4, 0], stretch: {horizontal: [0.2, 0.2, 0.5, 2, 0.5, 0], vertical: [0.1, 0.1, 0.6, 1, 1, 0.5]}, tint: Theme.colors.gold},
	{id: "divine-seal", form: FIGHT_PARTICLE_FORMS.RING, width: 82, height: 22, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 0.9, 0.7, 0.2, 0], y: stillFrames(30), scale: [0, 0, 0.4, 1, 1.35, 1.5], tint: Theme.colors.gold, onHit: true},
	...fightBurst("divine-rays", {radius: 44, size: 3, tint: Theme.colors.gold})
];
const RADIANT: FightChoreography = [...lightBeam("radiance", Theme.colors.gold),
	{id: "radiant-star", form: FIGHT_PARTICLE_FORMS.SPARK, width: 54, height: 54, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.8, 0.2, 0], rotation: [0, 0, 0, 30, 60, 90], scale: [0, 0, 0.45, 1.2, 1.4, 1.5], tint: Theme.colors.gold, onHit: true}
];

const WAVE: FightChoreography = [
	{id: "tidal-crest", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 74, height: 84, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.3, 0.7, 1, 0.2, 0], travel: [0, 0.1, 0.3, 0.95, 1, 1], rotation: stillFrames(88), stretch: {horizontal: [0.3, 0.5, 0.8, 1.15, 1.3, 1.4], vertical: [0.4, 0.6, 0.8, 1, 0.6, 0.2]}, tint: Theme.colors.blue},
	{id: "tidal-wake", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.WAVE, anchor: "actor", width: 50, height: 38, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0, 0.4, 0.9, 0.25, 0], travel: [0, 0, 0.15, 0.75, 1, 1], y: stillFrames(18), tint: Theme.colors.blue},
	{id: "tidal-wash", form: FIGHT_PARTICLE_FORMS.RING, width: 88, height: 18, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.7, 0.55, 0.1, 0], y: stillFrames(30), scale: [0, 0, 0.5, 1, 1.3, 1.5], tint: Theme.colors.blue, onHit: true},
	...fightBurst("tidal-drops", {radius: 38, size: 3, tint: Theme.colors.blue, form: FIGHT_PARTICLE_FORMS.MOTE})
];
const RAIN_TRACKS = [{id: "far-left", offset: -32, delay: 0}, {id: "left", offset: -16, delay: 0.04}, {id: "center", offset: 0, delay: 0}, {id: "right", offset: 16, delay: 0.08}, {id: "far-right", offset: 32, delay: 0.04}] as const;
const DELUGE: FightChoreography = [
	...RAIN_TRACKS.map((track): FightParticle => ({id: `deluge-${track.id}`, form: FIGHT_PARTICLE_FORMS.STREAK, width: 3, height: 32, timing: [0, 0.22 + track.delay, 0.3 + track.delay, 0.4 + track.delay, 0.58 + track.delay, 1], opacity: [0, 0, 0.5, 1, 0, 0], x: stillFrames(track.offset), y: [-44, -44, -30, 0, 30, 38], rotation: stillFrames(-12), tint: Theme.colors.blue})),
	{id: "deluge-puddle", form: FIGHT_PARTICLE_FORMS.RING, width: 88, height: 20, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.6, 0.7, 0.2, 0], y: stillFrames(30), scale: [0, 0, 0.5, 1, 1.25, 1.4], tint: Theme.colors.blue, onHit: true}
];
const MAELSTROM: FightChoreography = [...spiral("maelstrom", Theme.colors.blue),
	{id: "maelstrom-eye", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.WAVE, width: 34, height: 34, opacity: [0, 0.2, 0.8, 1, 0.2, 0], rotation: [0, 40, 100, 200, 280, 360], scale: [1, 1, 0.8, 0.5, 0.2, 0], tint: Theme.colors.blue},
	...fightBurst("maelstrom-release", {radius: 42, size: 3, tint: Theme.colors.blue, timing: FIGHT_TIMING.ECHO, form: FIGHT_PARTICLE_FORMS.MOTE})
];
const VENOM: FightChoreography = [
	{id: "venom-drop", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.POISON, anchor: "actor", width: 32, height: 32, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0, 0.7, 1, 0.2, 0], travel: [0, 0, 0.2, 1, 1, 1], y: [0, 0, -28, 0, 20, 24], rotation: [-25, -25, -5, 20, 40, 45], tint: VENOM_COLOR},
	{id: "venom-pool", form: FIGHT_PARTICLE_FORMS.RING, width: 68, height: 16, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.8, 0.65, 0.3, 0], y: stillFrames(30), scale: [0, 0, 0.5, 1, 1.15, 1.2], tint: VENOM_COLOR, onHit: true},
	{id: "venom-vapor", form: FIGHT_PARTICLE_FORMS.ARC, width: 40, height: 22, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.25, 0.55, 0.3, 0], y: [24, 24, 20, 8, -12, -24], rotation: [0, 0, 0, -20, -35, -45], tint: VENOM_COLOR, onHit: true},
	...fightBurst("venom-splash", {radius: 30, size: 3, tint: VENOM_COLOR, form: FIGHT_PARTICLE_FORMS.MOTE})
];
const CURSE: FightChoreography = [...spiral("curse-bindings", CURSE_COLOR),
	{id: "curse-sigil", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.CURSE, width: 42, height: 42, timing: FIGHT_TIMING.SWING, opacity: [0, 0.2, 0.7, 1, 0.4, 0], y: [-36, -26, -12, 0, 6, 12], scale: [0.4, 0.65, 0.8, 1, 0.9, 0.5], tint: CURSE_COLOR},
	{id: "curse-ground-seal", form: FIGHT_PARTICLE_FORMS.RING, width: 74, height: 18, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.65, 0.6, 0.2, 0], y: stillFrames(30), scale: [1.2, 1.2, 1, 0.7, 0.4, 0.1], tint: CURSE_COLOR}
];
const DRAIN: FightChoreography = [
	{id: "drain-tether", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 0, relativeWidth: FIGHTER_SPAN, height: 24, timing: FIGHT_TIMING.SWING, opacity: [0, 0, 0.4, 0.8, 0.4, 0], travel: stillFrames(0.5), tint: Theme.colors.green},
	{id: "drain-first-stream", form: FIGHT_PARTICLE_FORMS.MOTE, width: 9, height: 9, timing: [0, 0.39, 0.4, 0.56, 0.74, 1], opacity: [0, 0, 1, 0.9, 0.7, 0], travel: [0, 0, 0, -0.4, -0.85, -1], y: [0, 0, 0, -18, -10, 0], tint: Theme.colors.green, onHit: true},
	{id: "drain-second-stream", form: FIGHT_PARTICLE_FORMS.SPARK, width: 22, height: 22, timing: [0, 0.43, 0.46, 0.62, 0.8, 1], opacity: [0, 0, 0.8, 1, 0.6, 0], travel: [0, 0, 0, -0.4, -0.85, -1], y: [0, 0, 12, 22, 12, 0], tint: Theme.colors.green, onHit: true},
	{id: "drain-restored", form: FIGHT_PARTICLE_FORMS.RING, anchor: "actor", width: 66, height: 52, timing: [0, 0.65, 0.72, 0.8, 0.9, 1], opacity: [0, 0, 0.6, 0.7, 0.25, 0], scale: [0.2, 0.2, 0.5, 1, 1.2, 1.35], tint: Theme.colors.green, onHit: true}
];

const BLESSING: FightChoreography = [
	{id: "blessing-seal", form: FIGHT_PARTICLE_FORMS.RING, width: 78, height: 22, opacity: [0, 0.4, 0.8, 0.7, 0.3, 0], y: stillFrames(30), scale: [0.25, 0.65, 1, 1.1, 1.2, 1.3], tint: Theme.colors.gold},
	{id: "blessing-rise", form: FIGHT_PARTICLE_FORMS.STREAK, width: 3, height: 92, opacity: [0, 0.25, 0.7, 0.6, 0.2, 0], y: [24, 12, 0, -8, -18, -24], stretch: {horizontal: [0.3, 0.6, 1.2, 0.8, 0.3, 0], vertical: [0.2, 0.6, 1, 1, 0.8, 0.5]}, tint: Theme.colors.gold},
	{id: "blessing-strength", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.PIERCE, width: 24, height: 24, timing: [0, 0.2, 0.36, 0.5, 0.7, 1], opacity: [0, 0, 0.8, 1, 0.4, 0], x: stillFrames(-26), y: [18, 18, 0, -16, -28, -36], tint: Theme.colors.gold},
	{id: "blessing-defense", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.SHIELD, width: 24, height: 24, timing: [0, 0.28, 0.4, 0.58, 0.76, 1], opacity: [0, 0, 0.8, 1, 0.4, 0], x: stillFrames(26), y: [20, 20, 2, -14, -26, -34], tint: Theme.colors.blue},
	{id: "blessing-crown", form: FIGHT_PARTICLE_FORMS.SPARK, width: 34, height: 34, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.8, 1, 0.3, 0], y: [0, 0, -10, -20, -30, -36], scale: [0.2, 0.2, 0.65, 1, 0.8, 0.3], tint: Theme.colors.gold}
];
const HEAL: FightChoreography = [
	{id: "healing-pulse", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.HEAL, width: 34, height: 34, opacity: [0, 0.5, 1, 0.8, 0.4, 0], y: [8, 4, 0, -6, -14, -22], scale: [0.6, 0.85, 1.2, 0.95, 1.1, 0.6], tint: Theme.colors.green},
	{id: "healing-lower-ring", form: FIGHT_PARTICLE_FORMS.RING, width: 68, height: 20, opacity: [0, 0.3, 0.7, 0.7, 0.2, 0], y: [32, 24, 8, -6, -24, -36], scale: [0.6, 0.8, 1, 1, 0.9, 0.7], tint: Theme.colors.green},
	{id: "healing-upper-ring", form: FIGHT_PARTICLE_FORMS.RING, width: 60, height: 18, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.6, 0.7, 0.3, 0], y: [32, 32, 24, 8, -10, -26], tint: Theme.colors.green}
];
const PROTECTION: FightChoreography = [
	{id: "protecting-shield", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.SHIELD, width: 48, height: 48, opacity: [0, 0.5, 1, 1, 0.55, 0], y: [24, 12, 0, 0, -2, -6], stretch: {horizontal: [0.4, 0.7, 1.1, 1, 1, 0.9], vertical: [0.2, 0.6, 1, 1.05, 1.05, 1.1]}, tint: Theme.colors.blue},
	{id: "protection-left", form: FIGHT_PARTICLE_FORMS.ARC, width: 44, height: 86, opacity: [0, 0.2, 0.75, 0.8, 0.3, 0], x: [-38, -28, -18, -18, -18, -18], rotation: stillFrames(-90), tint: Theme.colors.blue},
	{id: "protection-right", form: FIGHT_PARTICLE_FORMS.ARC, width: 44, height: 86, opacity: [0, 0.2, 0.75, 0.8, 0.3, 0], x: [38, 28, 18, 18, 18, 18], rotation: stillFrames(90), tint: Theme.colors.blue},
	{id: "protection-glint", form: FIGHT_PARTICLE_FORMS.SPARK, width: 22, height: 22, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.8, 0.7, 0, 0], x: [-16, -16, -16, 4, 20, 24], y: [-20, -20, -20, -8, 8, 12], tint: Theme.colors.gold}
];
const BREATH: FightChoreography = [
	{id: "rest-inhale", form: FIGHT_PARTICLE_FORMS.ARC, width: 48, height: 16, opacity: [0, 0.3, 0.6, 0.4, 0.1, 0], x: [-24, -14, 0, 10, 20, 28], y: [8, 2, -6, -12, -18, -24], stretch: {horizontal: [0.5, 0.8, 1, 1.2, 1.3, 1.4], vertical: [0.6, 0.8, 1, 1, 0.6, 0.2]}, tint: Theme.colors.blue},
	{id: "rest-exhale", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.REST, width: 36, height: 36, timing: [0, 0.3, 0.4, 0.6, 0.8, 1], opacity: [0, 0, 0.3, 0.7, 0.3, 0], x: [-8, -8, 0, 12, 22, 30], y: [16, 16, 10, 0, -10, -18], tint: Theme.colors.blue},
	{id: "rest-trace", form: FIGHT_PARTICLE_FORMS.ARC, width: 58, height: 12, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.2, 0.5, 0.2, 0], x: [-18, -18, -12, 0, 16, 26], y: [24, 24, 18, 8, -4, -12], tint: Theme.colors.blue}
];
const FOCUS: FightChoreography = [
	{id: "focus-reticle", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.CHARGE, width: 44, height: 44, opacity: [0, 0.3, 0.8, 1, 0.5, 0], rotation: [-45, -30, -10, 0, 0, 0], scale: [1.4, 1.2, 0.9, 0.75, 0.7, 0.6], tint: Theme.colors.gold},
	{id: "focus-left", form: FIGHT_PARTICLE_FORMS.STREAK, width: 28, height: 2, opacity: [0, 0.4, 0.7, 0.8, 0, 0], x: [-44, -34, -24, -12, -8, -6], tint: Theme.colors.gold},
	{id: "focus-right", form: FIGHT_PARTICLE_FORMS.STREAK, width: 28, height: 2, opacity: [0, 0.4, 0.7, 0.8, 0, 0], x: [44, 34, 24, 12, 8, 6], tint: Theme.colors.gold}
];
const CHARGED_LIGHT: FightChoreography = [...FOCUS,
	{id: "gathered-light", form: FIGHT_PARTICLE_FORMS.SPARK, width: 34, height: 34, opacity: [0, 0.2, 0.4, 0.7, 1, 0], scale: [0.1, 0.25, 0.45, 0.7, 1.1, 0.2], tint: Theme.colors.gold}
];
const CHARGED_WATER: FightChoreography = [...spiral("gathering-water", Theme.colors.blue),
	{id: "gathered-water", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.WAVE, width: 32, height: 32, opacity: [0, 0.2, 0.5, 0.7, 1, 0], scale: [0.2, 0.4, 0.55, 0.75, 1, 0.3], tint: Theme.colors.blue}
];
const CHARGED_WEAPON: FightChoreography = [
	{id: "gathered-weapon", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.HEAVY, width: 42, height: 42, opacity: [0, 0.7, 1, 1, 0.8, 0], y: [8, -8, -22, -28, -28, -22], rotation: [0, -20, -40, -55, -55, -50]}, ...FOCUS
];
const COUNTER_PRELUDE: FightChoreography = [
	{id: "counter-parry", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.SHIELD, anchor: "actor", width: 34, height: 34, timing: FIGHT_TIMING.CAST, opacity: [0, 0.7, 0.9, 0.5, 0, 0], rotation: [0, -16, -12, 4, 12, 12], tint: Theme.colors.blue},
	{id: "counter-spark", form: FIGHT_PARTICLE_FORMS.SPARK, anchor: "actor", width: 26, height: 26, timing: [0, 0.1, 0.14, 0.18, 0.26, 1], opacity: [0, 0, 1, 0.7, 0, 0], x: stillFrames(18), tint: Theme.colors.gold}
];
const MIMIC_PRELUDE: FightChoreography = [
	{id: "copy-left", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 50, height: 42, timing: FIGHT_TIMING.CAST, opacity: [0, 0.7, 0.9, 0.5, 0, 0], rotation: [-45, -15, 45, 100, 150, 180], tint: Theme.colors.blue},
	{id: "copy-right", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 50, height: 42, timing: FIGHT_TIMING.CAST, opacity: [0, 0.7, 0.9, 0.5, 0, 0], rotation: [135, 165, 225, 280, 330, 360], tint: Theme.colors.gold}
];

export const FIGHT_CAST_PRELUDES: Readonly<Partial<Record<string, FightChoreography>>> = {counterAttack: COUNTER_PRELUDE, mimicAttack: MIMIC_PRELUDE, magicMimicAttack: MIMIC_PRELUDE};
export const FIGHT_CHARGING_SIGNATURES: Readonly<Partial<Record<string, FightChoreography>>> = {
	chargeDeluge: CHARGED_WATER, chargeMaelstromAttack: CHARGED_WATER, chargeChargeMaelstromAttack: CHARGED_WATER,
	chargeRadiantBlastAttack: CHARGED_LIGHT, chargeChargeRadiantBlastAttack: CHARGED_LIGHT, chargeUltimateAttack: CHARGED_LIGHT,
	chargeClubSmashAttack: CHARGED_WEAPON, chargeChargingAttack: CHARGED_WEAPON,
	deluge: CHARGED_WATER, maelstromAttack: CHARGED_WATER, radiantBlastAttack: CHARGED_LIGHT, ultimateAttack: CHARGED_LIGHT, clubSmashAttack: CHARGED_WEAPON, chargingAttack: CHARGED_WEAPON
};
export const FIGHT_PERIODIC_SIGNATURES: Readonly<Partial<Record<string, FightChoreography>>> = {
	poisoned: VENOM.filter(particle => particle.id === "venom-pool" || particle.id === "venom-vapor"),
	burned: ERUPTION.filter(particle => particle.id === "eruption-left" || particle.id === "eruption-right"), frozen: FROST_BREATH.filter(particle => particle.id === "frost-crust"),
	paralyzed: LIGHTNING.filter(particle => particle.id === "lightning-afterimage"), stunned: spiral("stunned-orbit", Theme.colors.gold), confused: spiral("confused-orbit", Theme.colors.blue),
	cursed: CURSE.filter(particle => particle.id === "curse-sigil" || particle.id === "curse-ground-seal"),
	drowning: WAVE.filter(particle => particle.id === "tidal-wash"), submerged: WAVE.filter(particle => particle.id === "tidal-wash"),
	concentrated: FOCUS, protected: PROTECTION.filter(particle => particle.id === "protecting-shield"), sleeping: BREATH, outOfBreath: BREATH,
	bleeding: [{id: "bleeding-drop", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.POISON, width: 22, height: 22, opacity: [0, 0.3, 0.8, 0.6, 0.2, 0], y: [-6, -4, 0, 12, 24, 30], tint: Theme.colors.red}]
};

export const FIGHT_SPELL_SIGNATURES: Readonly<Partial<Record<string, FightChoreography>>> = {
	benediction: BLESSING, concentration: FOCUS, concentrated: FOCUS,
	defenseBuff: PROTECTION, protection: [...PROTECTION, ...FOCUS.filter(particle => particle.id === "focus-reticle")],
	rockShieldAttack: PROTECTION.map(particle => ({...particle, tint: Theme.colors.muted})), stoneSkinAttack: [...PROTECTION.map(particle => ({...particle, tint: Theme.colors.muted})), ...fightBurst("stone-dust", {anchor: "actor", radius: 30, size: 3, tint: Theme.colors.muted})],
	crystallineArmorAttack: [...PROTECTION.map(particle => ({...particle, tint: ICE_COLOR})), ...CRYSTAL.filter(particle => particle.onHit)],
	tentacleShield: [...PROTECTION.filter(particle => particle.id === "protecting-shield"), ...spiral("tentacle-ward", Theme.colors.blue)],
	resting: BREATH, rest: BREATH, helpBreathe: [...BREATH, ...HEAL.filter(particle => particle.id !== "healing-pulse")],
	hydraulicHeal: HEAL, smallRegen: HEAL, fairyHeal: [...HEAL, ...BLESSING.filter(particle => particle.id === "blessing-crown")],
	healOwnerInEnergyRange: HEAL, healEveryone: [...HEAL, ...HEAL.map((particle): FightParticle => ({...particle, id: `shared-${particle.id}`, anchor: "other"}))],
	magmaBathAttack: [...HEAL.map(particle => ({...particle, tint: FIRE_COLOR})), ...ERUPTION.filter(particle => particle.id === "eruption-fissure")],
	rainbowPower: [...BLESSING, ...HEAL.filter(particle => particle.id === "healing-upper-ring")],
	fireAttack: FIREBALL, spitFire: [...elementalBreath("fire-breath", {glyph: FIGHT_MOTIONS.FLAME, tint: FIRE_COLOR, spread: 18}), ...fightBurst("fire-breath-embers", {radius: 34, size: 3, tint: FIRE_COLOR})],
	eruptionAttack: ERUPTION, lavaWaveAttack: WAVE.map(particle => ({...particle, tint: FIRE_COLOR})),
	heatMudAttack: [...VENOM.map(particle => ({...particle, tint: FIRE_COLOR})), ...elementalBreath("steam", {glyph: FIGHT_MOTIONS.REST, tint: Theme.colors.faint, spread: 16})],
	glacialBreathAttack: FROST_BREATH, blizzardRageAttack: BLIZZARD, crystalShardAttack: CRYSTAL,
	snowBall: [...CRYSTAL.filter(particle => particle.onHit), {id: "snowball", form: FIGHT_PARTICLE_FORMS.RING, anchor: "actor", width: 24, height: 24, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.4, 1, 1, 0, 0], travel: [0, 0.15, 0.4, 1, 1, 1], y: [0, -20, -28, 0, 12, 18], tint: ICE_COLOR}],
	frozenKissAttack: FROZEN_KISS, icySeductionAttack: [...FROZEN_KISS, ...fightBurst("icy-sparkles", {radius: 36, size: 2, tint: ICE_COLOR})],
	startPolarEmbraceAttack: [...spiral("polar-embrace", ICE_COLOR), ...FROST_BREATH.filter(particle => particle.onHit)],
	celestialLightning: LIGHTNING, lightRayAttack: lightBeam("light-ray", Theme.colors.gold), divineAttack: DIVINE, radiantBlastAttack: RADIANT,
	callOfTheSea: WAVE, tidalWave: [...WAVE, ...spiral("tidal-current", Theme.colors.blue)], deluge: DELUGE, maelstromAttack: MAELSTROM,
	waterJet: lightBeam("water-jet", Theme.colors.blue), wateryGust: elementalBreath("water-gust", {glyph: FIGHT_MOTIONS.WAVE, tint: Theme.colors.blue, spread: 22}),
	poisonousAttack: VENOM, petPoison: [...VENOM, {id: "pet-venom-mark", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.SUMMON, anchor: "actor", width: 24, height: 24, opacity: [0, 0.65, 0.4, 0, 0, 0], tint: VENOM_COLOR}],
	blackCorrosion: [...VENOM, ...spiral("corrosion", Theme.colors.ink)],
	cursedAttack: CURSE, darkAttack: [...CURSE, ...fightBurst("dark-fragments", {radius: 36, size: 2, tint: CURSE_COLOR})],
	abyssalAura: [...spiral("abyss", Theme.colors.ink), ...CURSE.filter(particle => particle.form === FIGHT_PARTICLE_FORMS.RING)],
	cursedOfTheSea: [...CURSE, ...spiral("sea-curse", Theme.colors.blue)], spectralRevengeAttack: [...CURSE, ...lightBeam("spectral-return", CURSE_COLOR)],
	energeticAttack: DRAIN, vampirism: DRAIN.map(particle => ({...particle, tint: Theme.colors.red})),
	heatDrainAttack: DRAIN.map(particle => ({...particle, tint: FIRE_COLOR})), breathTakingAttack: DRAIN.map(particle => ({...particle, tint: Theme.colors.blue})),
	sepulcralHunger: [...DRAIN, ...CURSE.filter(particle => particle.form === FIGHT_PARTICLE_FORMS.GLYPH)]
};