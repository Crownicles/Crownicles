import {FightMotion} from "@/src/display/FightMotion";

export const FIGHT_EFFECT_FRAMES = [0, 0.18, 0.4, 0.56, 0.78, 1];
export const FIGHT_EFFECT_LAYOUT = {anchors: {self: 0.235, opponent: 0.765}, centerY: 76};
export const FIGHT_PARTICLE_FORMS = {STREAK: "streak", ARC: "arc", RING: "ring", SHARD: "shard", GLYPH: "glyph", SPARK: "spark", MOTE: "mote"} as const;
export type FightFrames = readonly [number, number, number, number, number, number];
export type FightParticle = {
	id: string;
	form: typeof FIGHT_PARTICLE_FORMS[keyof typeof FIGHT_PARTICLE_FORMS];
	anchor?: "actor" | "target" | "other";
	width: number;
	relativeWidth?: number;
	height: number;
	opacity: FightFrames;
	timing?: FightFrames;
	x?: FightFrames;
	y?: FightFrames;
	scale?: FightFrames;
	stretch?: {horizontal: FightFrames; vertical: FightFrames};
	rotation?: FightFrames;
	travel?: FightFrames;
	tint?: string;
	glyph?: FightMotion;
	onHit?: boolean;
};
export type FightChoreography = readonly FightParticle[];
export const FIGHT_TIMING = {
	SWING: [0, 0.2, 0.34, 0.4, 0.58, 1],
	FLIGHT: [0, 0.18, 0.28, 0.4, 0.56, 1],
	IMPACT: [0, 0.39, 0.4, 0.47, 0.7, 1],
	ECHO: [0, 0.4, 0.46, 0.6, 0.8, 1],
	CAST: [0, 0.12, 0.25, 0.32, 0.4, 1],
	GLIMMER: [0, 0.38, 0.4, 0.44, 0.54, 1]
} as const satisfies Record<string, FightFrames>;

export function stillFrames(value: number): FightFrames {
	return [value, value, value, value, value, value];
}

export function multiplyFrames(frames: FightFrames, multiplier: number): FightFrames {
	return [frames[0] * multiplier, frames[1] * multiplier, frames[2] * multiplier, frames[3] * multiplier, frames[4] * multiplier, frames[5] * multiplier];
}

const BURST_DIRECTIONS = [
	{id: "upper-left", horizontal: -0.8, vertical: -0.7, rotation: -45},
	{id: "upper-right", horizontal: 0.8, vertical: -0.7, rotation: 45},
	{id: "left", horizontal: -1, vertical: 0, rotation: 90},
	{id: "right", horizontal: 1, vertical: 0, rotation: 90},
	{id: "lower-left", horizontal: -0.6, vertical: 0.6, rotation: 45},
	{id: "lower-right", horizontal: 0.6, vertical: 0.6, rotation: -45}
] as const;
const BURST_DISTANCE: FightFrames = [0, 0, 0.18, 0.65, 0.9, 1];
const BURST_HEIGHT_RATIO = 2;
type BurstStyle = {radius: number; size: number; anchor?: FightParticle["anchor"]; tint?: string; timing?: FightFrames; form?: FightParticle["form"]};

export function fightBurst(id: string, style: BurstStyle): FightChoreography {
	return BURST_DIRECTIONS.map(direction => ({
		id: `${id}-${direction.id}`, form: style.form ?? FIGHT_PARTICLE_FORMS.SHARD,
		width: style.size, height: style.size * BURST_HEIGHT_RATIO,
		timing: style.timing ?? FIGHT_TIMING.IMPACT, opacity: [0, 0, 1, 0.8, 0.3, 0],
		x: multiplyFrames(BURST_DISTANCE, direction.horizontal * style.radius),
		y: multiplyFrames(BURST_DISTANCE, direction.vertical * style.radius),
		rotation: stillFrames(direction.rotation), scale: [0, 0, 1, 0.85, 0.5, 0.1],
		onHit: style.anchor !== "actor",
		...(style.anchor ? {anchor: style.anchor} : {}), ...(style.tint ? {tint: style.tint} : {})
	}));
}