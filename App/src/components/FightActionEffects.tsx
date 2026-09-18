import {ReactNode} from "react";
import {Animated, StyleProp, StyleSheet, ViewStyle} from "react-native";
import {FightCue, FIGHT_OUTCOMES, FIGHT_MOTIONS} from "@/src/display/FightMotion";
import {FIGHT_EFFECT_FRAMES, FIGHT_EFFECT_LAYOUT, FIGHT_PARTICLE_FORMS, FightChoreography, FightFrames, FightParticle} from "@/src/display/FightEffectPrimitives";
import {AppIcons} from "@/src/AppIcons";
import {Cannon, Swords, Sword, Hammer, Sparkles, Flame, Snowflake, Zap, Waves, Droplets, HeartPulse, Shield, Wind, Crosshair, Skull, AudioLines, PawPrint, CircleDashed} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const REST_FRAMES: FightFrames = [0, 0, 0, 0, 0, 0];
const SCALE_FRAMES: FightFrames = [1, 1, 1, 1, 1, 1];
const MISS_OFFSET = 28;
const FILLED_PARTICLE_FORMS = new Set<FightParticle["form"]>([FIGHT_PARTICLE_FORMS.STREAK, FIGHT_PARTICLE_FORMS.SHARD, FIGHT_PARTICLE_FORMS.MOTE]);
const EFFECT_ICONS = {
	flame: Flame, frost: Snowflake, lightning: Zap, wave: Waves, poison: Droplets, shield: Shield,
	blessing: Sparkles, heal: HeartPulse, rest: Wind, charge: Crosshair, curse: Skull, drain: HeartPulse,
	roar: AudioLines, summon: PawPrint, dodge: Wind, debuff: CircleDashed, quake: Zap, mimic: Sparkles,
	bite: Swords, claw: Swords, slash: Swords, rapid: Sword, pierce: Sword, heavy: Hammer, shot: Cannon, return: CircleDashed
} as const;
const styles = StyleSheet.create({
	particle: {position: "absolute", alignItems: "center", justifyContent: "center"},
	streak: {borderRadius: 8},
	arc: {borderRadius: 80, borderTopWidth: 4, borderRightWidth: 1},
	ring: {borderRadius: 100, borderWidth: 2},
	shard: {borderRadius: 2},
	mote: {borderRadius: 12}
});

type EffectProps = {cue: FightCue; progress: Animated.Value; width: number};
type AnimatedFrame = Animated.AnimatedInterpolation<number>;
type ParticleScale = [{scale: AnimatedFrame}, {scaleX: AnimatedFrame}, {scaleY: AnimatedFrame}];

function interpolate(progress: Animated.Value, frames: readonly number[], timing: readonly number[]): Animated.AnimatedInterpolation<number> {
	return progress.interpolate({inputRange: [...timing], outputRange: [...frames], extrapolate: "clamp"});
}

function ParticleImage({particle, cue, color}: {particle: FightParticle; cue: FightCue; color: string}): ReactNode {
	const size = Math.min(particle.width, particle.height);
	if (particle.form === FIGHT_PARTICLE_FORMS.SPARK) return <Sparkles size={size} color={color} />;
	if (particle.form !== FIGHT_PARTICLE_FORMS.GLYPH) return null;
	const emoji = particle.glyph ? null : AppIcons.getIconOrNull(`fightActions.${cue.actionId}`);
	const Icon = EFFECT_ICONS[particle.glyph ?? cue.motion];
	if (particle.glyph === FIGHT_MOTIONS.SHOT) return <Animated.View style={{transform: [{scaleX: cue.actor === "self" ? 1 : -1}]}}><Icon size={size} color={color} /></Animated.View>;
	return emoji ? <TwemojiIcon emoji={emoji} size={size} /> : <Icon size={size} color={color} />;
}

function particleHorizontalFrames(particle: FightParticle, cue: FightCue, width: number): number[] {
	const direction = cue.actor === "self" ? 1 : -1;
	const miss = cue.outcome === FIGHT_OUTCOMES.MISSED ? direction * MISS_OFFSET : 0;
	const source = width * FIGHT_EFFECT_LAYOUT.anchors[cue.actor];
	const target = width * FIGHT_EFFECT_LAYOUT.anchors[cue.target] + miss;
	const origins = {actor: source, target, other: width * FIGHT_EFFECT_LAYOUT.anchors[cue.actor === "self" ? "opponent" : "self"]};
	const origin = origins[particle.anchor ?? "target"];
	return (particle.x ?? REST_FRAMES).map((offset, index) => origin + direction * offset + (target - source) * (particle.travel?.[index] ?? 0));
}

function particleAppearance(particle: FightParticle, color: string, stageWidth: number): StyleProp<ViewStyle> {
	const shape = particle.form === FIGHT_PARTICLE_FORMS.GLYPH || particle.form === FIGHT_PARTICLE_FORMS.SPARK ? null : styles[particle.form];
	const width = particle.width + (particle.relativeWidth ?? 0) * stageWidth;
	return [styles.particle, shape, {
		width, height: particle.height, top: FIGHT_EFFECT_LAYOUT.centerY - particle.height / 2, left: -width / 2,
		borderColor: color, ...(FILLED_PARTICLE_FORMS.has(particle.form) ? {backgroundColor: color} : {})
	}];
}

function particleScale(particle: FightParticle, progress: Animated.Value): ParticleScale {
	const timing = particle.timing ?? FIGHT_EFFECT_FRAMES;
	return [
		{scale: interpolate(progress, particle.scale ?? SCALE_FRAMES, timing)},
		{scaleX: interpolate(progress, particle.stretch?.horizontal ?? SCALE_FRAMES, timing)},
		{scaleY: interpolate(progress, particle.stretch?.vertical ?? SCALE_FRAMES, timing)}
	];
}

function AnimatedParticle({particle, cue, progress, width}: EffectProps & {particle: FightParticle}): ReactNode {
	const direction = cue.actor === "self" ? 1 : -1;
	const color = particle.tint ?? cue.color;
	const timing = particle.timing ?? FIGHT_EFFECT_FRAMES;
	return <Animated.View testID={`fight-particle-${particle.id}`} style={[particleAppearance(particle, color, width), {
		opacity: interpolate(progress, particle.opacity, timing),
		transform: [{translateX: interpolate(progress, particleHorizontalFrames(particle, cue, width), timing)}, {translateY: interpolate(progress, particle.y ?? REST_FRAMES, timing)}, {rotate: progress.interpolate({inputRange: [...timing], outputRange: (particle.rotation ?? REST_FRAMES).map(angle => `${angle * direction}deg`)})}, ...particleScale(particle, progress)]
	}]}><ParticleImage particle={particle} cue={cue} color={color} /></Animated.View>;
}

export function FightActionEffects({choreography, ...props}: EffectProps & {choreography: FightChoreography}): ReactNode {
	return choreography.filter(particle => !particle.onHit || !props.cue.missed).map(particle => <AnimatedParticle key={particle.id} particle={particle} {...props} />);
}