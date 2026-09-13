import {FIGHT_MOTIONS} from "@/src/display/FightMotion";
import {FIGHT_PARTICLE_FORMS, FIGHT_TIMING, FightChoreography, FightFrames, fightBurst, stillFrames} from "@/src/display/FightEffectPrimitives";
import {Theme} from "@/src/design/Theme";

type CutStyle = {angle: number; length: number; curve: number; timing: FightFrames};

function bladeStroke(id: string, style: CutStyle): FightChoreography {
	return [
		{id: `${id}-blade`, form: FIGHT_PARTICLE_FORMS.ARC, width: style.length, height: style.curve, timing: style.timing, opacity: [0, 0, 0.4, 1, 0.4, 0], x: [-26, -26, -18, 0, 16, 24], rotation: stillFrames(style.angle), stretch: {horizontal: [0.1, 0.1, 0.4, 1.15, 1.35, 1.4], vertical: [0.4, 0.4, 0.6, 1, 0.8, 0.2]}},
		{id: `${id}-edge`, form: FIGHT_PARTICLE_FORMS.STREAK, width: 2, height: style.length, timing: style.timing, opacity: [0, 0, 0, 1, 0.15, 0], rotation: stillFrames(style.angle), scale: [0, 0, 0.2, 1, 0.8, 0], tint: Theme.colors.paper}
	];
}

const SIMPLE: FightChoreography = [
	{id: "sword-draw", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.PIERCE, anchor: "actor", width: 34, height: 34, timing: FIGHT_TIMING.SWING, opacity: [0, 0.7, 1, 0.8, 0, 0], travel: [0, 0, 0.3, 1, 1, 1], y: [-8, -18, -22, 0, 18, 20], rotation: [-40, -50, -40, 45, 70, 70]},
	...bladeStroke("clean-cut", {angle: 38, length: 84, curve: 42, timing: FIGHT_TIMING.SWING}),
	...fightBurst("steel-sparks", {radius: 28, size: 2, tint: Theme.colors.gold})
];
const QUICK: FightChoreography = [
	...bladeStroke("quick-opening", {angle: 48, length: 70, curve: 24, timing: [0, 0.25, 0.36, 0.4, 0.46, 1]}),
	...bladeStroke("quick-return", {angle: -42, length: 80, curve: 28, timing: [0, 0.4, 0.42, 0.46, 0.52, 1]}),
	...bladeStroke("quick-finish", {angle: 72, length: 64, curve: 20, timing: [0, 0.48, 0.5, 0.54, 0.62, 1]}),
	{id: "quick-afterimage", form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 72, height: 2, timing: FIGHT_TIMING.SWING, opacity: [0, 0, 0.3, 0.9, 0.1, 0], travel: [0, 0, 0.2, 0.75, 1, 1], y: stillFrames(16)}
];
const PIERCING: FightChoreography = [
	{id: "piercing-aim", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.CHARGE, width: 28, height: 28, timing: FIGHT_TIMING.CAST, opacity: [0, 0.3, 0.75, 0.5, 0, 0], scale: [1.2, 1, 0.75, 0.5, 0.2, 0], tint: Theme.colors.ink},
	{id: "piercing-blade", form: FIGHT_PARTICLE_FORMS.SHARD, anchor: "actor", width: 64, height: 5, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0, 0.8, 1, 0.1, 0], travel: [0, 0, 0.1, 1, 1.15, 1.15], stretch: {horizontal: [0.2, 0.2, 0.6, 1.35, 1, 0.2], vertical: [1, 1, 1, 0.6, 0.2, 0.1]}},
	{id: "piercing-pressure", form: FIGHT_PARTICLE_FORMS.RING, width: 20, height: 62, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.7, 0.15, 0], scale: [0.1, 0.1, 0.45, 1, 1.3, 1.5], onHit: true},
	{id: "piercing-exit", form: FIGHT_PARTICLE_FORMS.STREAK, width: 42, height: 2, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.8, 0.4, 0, 0], x: [0, 0, 18, 30, 42, 44], onHit: true}
];
const INTENSE: FightChoreography = [
	...bladeStroke("intense-rise", {angle: -48, length: 100, curve: 54, timing: FIGHT_TIMING.SWING}),
	...bladeStroke("intense-reversal", {angle: 48, length: 108, curve: 60, timing: [0, 0.4, 0.46, 0.5, 0.64, 1]}),
	...fightBurst("intense-fragments", {radius: 42, size: 3})
];
const SABOTAGE: FightChoreography = [...PIERCING,
	{id: "armor-break", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.SHIELD, width: 42, height: 42, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 0.8, 0.55, 0, 0], rotation: [0, 0, 0, 18, 38, 50], stretch: {horizontal: [1, 1, 1, 1.2, 1.6, 1.8], vertical: [1, 1, 1, 0.75, 0.3, 0.1]}, tint: Theme.colors.blue, onHit: true},
	...fightBurst("armor-pieces", {radius: 38, size: 4, tint: Theme.colors.blue})
];
const SHIELD_BASH: FightChoreography = [
	{id: "shield-windup", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.SHIELD, anchor: "actor", width: 52, height: 52, timing: FIGHT_TIMING.SWING, opacity: [0, 0.8, 1, 1, 0.25, 0], travel: [0, 0, 0.15, 1, 1, 1], rotation: [-16, -22, -10, 12, 20, 20], tint: Theme.colors.blue},
	{id: "shield-pressure", form: FIGHT_PARTICLE_FORMS.ARC, width: 72, height: 92, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 0.8, 0.6, 0.15, 0], rotation: stillFrames(90), stretch: {horizontal: [0.2, 0.2, 0.6, 1, 1.3, 1.4], vertical: [1, 1, 1, 0.9, 0.7, 0.4]}, tint: Theme.colors.blue, onHit: true},
	...fightBurst("shield-rivets", {radius: 36, size: 3, tint: Theme.colors.gold})
];
const RAM: FightChoreography = [
	{id: "ram-trail-high", form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 84, height: 3, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0, 0.6, 1, 0.1, 0], travel: [0, 0, 0.1, 0.8, 1, 1], y: stillFrames(-16)},
	{id: "ram-trail-low", form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 58, height: 2, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0, 0.3, 0.75, 0.1, 0], travel: [0, 0, 0, 0.6, 1, 1], y: stillFrames(18)},
	{id: "ram-contact", form: FIGHT_PARTICLE_FORMS.ARC, width: 56, height: 76, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.6, 0.1, 0], rotation: stillFrames(90), scale: [0.2, 0.2, 0.6, 1, 1.3, 1.4], onHit: true},
	...fightBurst("ram-dust", {radius: 42, size: 3, tint: Theme.colors.faint})
];
const DIVE: FightChoreography = [
	{id: "aerial-weapon", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.PIERCE, anchor: "actor", width: 36, height: 36, timing: FIGHT_TIMING.SWING, opacity: [0, 0.7, 1, 1, 0, 0], travel: [0, 0.1, 0.45, 1, 1, 1], y: [0, -30, -38, 0, 18, 22], rotation: [-30, -45, 15, 45, 65, 65]},
	{id: "dive-trail", form: FIGHT_PARTICLE_FORMS.STREAK, width: 4, height: 106, timing: FIGHT_TIMING.SWING, opacity: [0, 0, 0, 1, 0.2, 0], y: [-32, -32, -32, -12, 12, 20], rotation: stillFrames(-35)},
	{id: "landing-ring", form: FIGHT_PARTICLE_FORMS.RING, width: 84, height: 20, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 0.8, 0.6, 0.15, 0], y: stillFrames(30), scale: [0.1, 0.1, 0.4, 1, 1.4, 1.5], onHit: true},
	...fightBurst("landing-dust", {radius: 38, size: 3, tint: Theme.colors.faint})
];

function whipStrike(id: string, curve: number): FightChoreography {
	return [
		{id: `${id}-windup`, form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 64, height: curve, timing: FIGHT_TIMING.SWING, opacity: [0, 0.7, 0.8, 0.2, 0, 0], rotation: [-75, -45, 0, 35, 60, 60]},
		{id: `${id}-lash`, form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 120, height: curve, timing: FIGHT_TIMING.SWING, opacity: [0, 0, 0.6, 1, 0.3, 0], travel: [0, 0, 0.2, 0.8, 1, 1], rotation: [-35, -35, -15, 20, 50, 70], stretch: {horizontal: [0.2, 0.2, 0.6, 1.2, 0.8, 0.4], vertical: [1, 1, 1, 0.6, 1.3, 1.5]}},
		{id: `${id}-curl`, form: FIGHT_PARTICLE_FORMS.ARC, width: 60, height: 62, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.85, 0.5, 0.1, 0], rotation: [0, 0, 45, 160, 220, 250], scale: [0.2, 0.2, 1, 0.9, 0.5, 0.2], onHit: true}
	];
}

const STEAL: FightChoreography = [
	{id: "steal-hook", form: FIGHT_PARTICLE_FORMS.ARC, width: 50, height: 42, timing: FIGHT_TIMING.SWING, opacity: [0, 0, 0.7, 1, 0.3, 0], rotation: [-45, -45, -30, 90, 180, 220], scale: [0.2, 0.2, 1, 0.75, 0.4, 0.2]},
	{id: "stolen-weapon", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.PIERCE, width: 34, height: 34, timing: [0, 0.39, 0.4, 0.6, 0.8, 1], opacity: [0, 0, 1, 1, 0.7, 0], travel: [0, 0, 0, -0.45, -0.9, -1], y: [0, 0, 0, -26, -12, 0], rotation: [0, 0, 0, -120, -200, -240], onHit: true},
	{id: "steal-return", form: FIGHT_PARTICLE_FORMS.ARC, width: 64, height: 18, timing: FIGHT_TIMING.ECHO, opacity: [0, 0, 0.6, 0.7, 0.2, 0], travel: [0, 0, 0, -0.4, -0.85, -1], y: [0, 0, -8, -22, -14, 0], tint: Theme.colors.gold, onHit: true}
];
const THROW: FightChoreography = [
	{id: "grasp-left", form: FIGHT_PARTICLE_FORMS.ARC, width: 34, height: 66, timing: FIGHT_TIMING.CAST, opacity: [0, 0.3, 1, 0.6, 0, 0], x: [-30, -24, -12, -8, -8, -8], rotation: stillFrames(-90)},
	{id: "grasp-right", form: FIGHT_PARTICLE_FORMS.ARC, width: 34, height: 66, timing: FIGHT_TIMING.CAST, opacity: [0, 0.3, 1, 0.6, 0, 0], x: [30, 24, 12, 8, 8, 8], rotation: stillFrames(90)},
	{id: "throw-arc", form: FIGHT_PARTICLE_FORMS.ARC, width: 92, height: 66, timing: FIGHT_TIMING.SWING, opacity: [0, 0.2, 0.8, 1, 0.2, 0], y: [0, -12, -30, 0, 14, 20], rotation: [-120, -90, -30, 45, 90, 110]},
	...fightBurst("throw-impact", {radius: 46, size: 4, tint: Theme.colors.faint})
];

const CANNON: FightChoreography = [
	{id: "cannon-aim", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.CHARGE, anchor: "actor", width: 34, height: 34, timing: FIGHT_TIMING.CAST, opacity: [0, 0.4, 1, 0.6, 0, 0], scale: [1.2, 1, 0.7, 0.3, 0, 0], tint: Theme.colors.ink},
	{id: "cannon-barrel-flash", form: FIGHT_PARTICLE_FORMS.STREAK, anchor: "actor", width: 48, height: 5, timing: [0, 0.25, 0.28, 0.32, 0.38, 1], opacity: [0, 0, 1, 0.6, 0, 0], x: stillFrames(20), stretch: {horizontal: [0, 0, 0.6, 1.25, 0.5, 0], vertical: [1, 1, 1, 0.7, 0.2, 0.1]}, tint: Theme.colors.gold},
	{id: "cannon-shell", form: FIGHT_PARTICLE_FORMS.MOTE, anchor: "actor", width: 16, height: 16, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0, 1, 1, 0, 0], travel: [0, 0, 0.04, 1, 1.04, 1.04], y: [0, 0, -2, 0, 8, 12], stretch: {horizontal: [1, 1, 1, 1.35, 0.5, 0.1], vertical: [1, 1, 1, 0.7, 0.5, 0.1]}, tint: Theme.colors.ink},
	{id: "cannon-smoke", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 40, height: 28, timing: [0, 0.25, 0.29, 0.4, 0.64, 1], opacity: [0, 0, 0.45, 0.4, 0.15, 0], x: [-6, -6, -6, -12, -20, -28], y: [0, 0, 0, -12, -24, -36], scale: [0.2, 0.2, 0.5, 0.9, 1.2, 1.5], tint: Theme.colors.faint},
	{id: "cannon-impact-ring", form: FIGHT_PARTICLE_FORMS.RING, width: 56, height: 56, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.55, 0.1, 0], scale: [0.1, 0.1, 0.4, 1.15, 1.45, 1.6], tint: Theme.colors.gold, onHit: true},
	...fightBurst("cannon-muzzle", {anchor: "actor", radius: 26, size: 3, tint: Theme.colors.gold, timing: [0, 0.25, 0.28, 0.32, 0.4, 1]}),
	...fightBurst("cannon-shrapnel", {radius: 42, size: 4, tint: Theme.colors.ink})
];
const BOULDER: FightChoreography = [
	{id: "boulder", form: FIGHT_PARTICLE_FORMS.SHARD, anchor: "actor", width: 30, height: 28, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.6, 1, 1, 0, 0], travel: [0, 0.15, 0.45, 1, 1, 1], y: [4, -24, -34, 0, 12, 18], rotation: [0, 40, 80, 145, 170, 190], tint: Theme.colors.muted},
	{id: "boulder-shadow", form: FIGHT_PARTICLE_FORMS.RING, anchor: "actor", width: 36, height: 8, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.2, 0.25, 0.6, 0.1, 0], travel: [0, 0.15, 0.45, 1, 1, 1], y: stillFrames(32), scale: [0.8, 0.5, 0.4, 1, 1.2, 1.4], tint: Theme.colors.faint},
	...fightBurst("stone-fragments", {radius: 40, size: 5, tint: Theme.colors.muted})
];
const BOOMERANG: FightChoreography = [
	{id: "boomerang", form: FIGHT_PARTICLE_FORMS.GLYPH, anchor: "actor", width: 38, height: 38, timing: [0, 0.18, 0.4, 0.6, 0.82, 1], opacity: [0, 0.9, 1, 1, 0.8, 0], travel: [0, 0.18, 1, 0.82, 0.25, 0], y: [0, -30, 0, 28, 18, 0], rotation: [0, 180, 400, 600, 800, 960]},
	{id: "boomerang-high-wake", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 64, height: 26, timing: [0, 0.18, 0.32, 0.4, 0.55, 1], opacity: [0, 0.2, 0.7, 0.8, 0, 0], travel: [0, 0.08, 0.45, 0.92, 1, 1], y: [0, -24, -30, -6, 6, 10], rotation: [-20, -20, -10, 20, 30, 30]},
	{id: "boomerang-low-wake", form: FIGHT_PARTICLE_FORMS.ARC, anchor: "actor", width: 60, height: 22, timing: [0, 0.4, 0.48, 0.62, 0.84, 1], opacity: [0, 0, 0.7, 0.7, 0.2, 0], travel: [1, 1, 0.95, 0.74, 0.22, 0], y: [0, 0, 18, 28, 16, 0], rotation: [180, 180, 190, 200, 210, 210]},
	...fightBurst("boomerang-contact", {radius: 24, size: 2, tint: Theme.colors.gold})
];
const BOMB: FightChoreography = [
	{id: "bomb-body", form: FIGHT_PARTICLE_FORMS.MOTE, anchor: "actor", width: 24, height: 24, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.6, 1, 1, 0, 0], travel: [0, 0.15, 0.45, 1, 1, 1], y: [0, -20, -28, 0, 8, 12], tint: Theme.colors.ink},
	{id: "bomb-fuse", form: FIGHT_PARTICLE_FORMS.SPARK, anchor: "actor", width: 18, height: 18, timing: FIGHT_TIMING.FLIGHT, opacity: [0, 0.7, 1, 1, 0, 0], travel: [0, 0.15, 0.45, 1, 1, 1], y: [-16, -36, -44, -16, 0, 0], tint: Theme.colors.gold},
	{id: "bomb-expansion", form: FIGHT_PARTICLE_FORMS.RING, width: 66, height: 60, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.7, 0.1, 0], scale: [0, 0, 0.3, 1.15, 1.35, 1.5], onHit: true},
	...fightBurst("bomb-debris", {radius: 48, size: 4, tint: Theme.colors.ink})
];
const FRENZY: FightChoreography = [...QUICK,
	...bladeStroke("frenzy-cross", {angle: -70, length: 90, curve: 46, timing: [0, 0.56, 0.58, 0.62, 0.7, 1]}),
	...fightBurst("frenzy-sparks", {radius: 32, size: 2, timing: FIGHT_TIMING.ECHO})
];
const POWERFUL: FightChoreography = [...INTENSE,
	{id: "powerful-compression", form: FIGHT_PARTICLE_FORMS.RING, width: 74, height: 74, timing: FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.6, 0.1, 0], stretch: {horizontal: [0.2, 0.2, 0.45, 1.2, 1.35, 1.4], vertical: [0.2, 0.2, 0.9, 0.8, 0.5, 0.2]}, onHit: true}
];
const CHARGE: FightChoreography = [...RAM,
	{id: "charging-focus", form: FIGHT_PARTICLE_FORMS.RING, anchor: "actor", width: 54, height: 54, timing: FIGHT_TIMING.CAST, opacity: [0, 0.4, 0.8, 1, 0, 0], scale: [1.2, 1, 0.7, 0.3, 0, 0], tint: Theme.colors.gold}
];
const TOOL: FightChoreography = [
	{id: "tool-swing", form: FIGHT_PARTICLE_FORMS.GLYPH, glyph: FIGHT_MOTIONS.HEAVY, width: 34, height: 34, timing: FIGHT_TIMING.SWING, opacity: [0, 0.8, 1, 1, 0.3, 0], y: [-8, -26, -28, 0, -12, -16], rotation: [-20, -50, -45, 25, -20, 0]},
	...fightBurst("tool-sparks", {radius: 24, size: 2, tint: Theme.colors.gold})
];

export const FIGHT_ATTACK_SIGNATURES: Readonly<Partial<Record<string, FightChoreography>>> = {
	simpleAttack: SIMPLE, quickAttack: QUICK, intenseAttack: INTENSE, piercingAttack: PIERCING,
	sabotageAttack: SABOTAGE, shieldAttack: SHIELD_BASH, powerfulAttack: POWERFUL,
	ramAttack: RAM, chargingAttack: CHARGE, aerialDiveAttack: DIVE, fatalFlight: [...DIVE, ...QUICK],
	grabAndThrowAttack: THROW, slamAttack: [...THROW, ...fightBurst("slam-ground", {radius: 44, size: 3})],
	stealWeapon: STEAL, useTool: TOOL, clubSmashAttack: [...TOOL, ...fightBurst("club-splinters", {radius: 42, size: 4})],
	goesWild: FRENZY, revenge: [...CHARGE, ...INTENSE], tailWhipAttack: whipStrike("tail", 22), tentacleBlowAttack: whipStrike("tentacle", 56),
	canonAttack: CANNON, boulderTossAttack: BOULDER, boomerangAttack: BOOMERANG, createBomb: BOMB,
	horn: [...PIERCING, ...fightBurst("horn-fragments", {radius: 30, size: 3})],
	peck: [...bladeStroke("peck", {angle: -65, length: 48, curve: 20, timing: FIGHT_TIMING.SWING}), ...fightBurst("peck-contact", {radius: 18, size: 2})],
	crush: [...SHIELD_BASH, ...fightBurst("crush-debris", {radius: 44, size: 5, tint: Theme.colors.muted})]
};