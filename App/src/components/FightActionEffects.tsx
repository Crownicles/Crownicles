import {ReactNode} from "react";
import {Animated, StyleSheet} from "react-native";
import {FightCue} from "@/src/display/FightMotion";
import {FIGHT_EFFECT_FRAMES, FIGHT_EFFECT_LAYOUT, FIGHT_PARTICLE_FORMS, FightChoreography, FightFrames, FightParticle} from "@/src/display/FightChoreography";
import {AppIcons} from "@/src/AppIcons";
import {Swords, Sparkles, Flame, Snowflake, Zap, Waves, Droplets, HeartPulse, Shield, Wind, Crosshair, Skull, AudioLines, PawPrint, CircleDashed} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Theme} from "@/src/design/Theme";

const REST_FRAMES: FightFrames = [0, 0, 0, 0, 0, 0];
const SCALE_FRAMES: FightFrames = [1, 1, 1, 1, 1, 1];
const MISS_OFFSET = 28;
const EFFECT_ICONS = {
	flame: Flame, frost: Snowflake, lightning: Zap, wave: Waves, poison: Droplets, shield: Shield,
	blessing: Sparkles, heal: HeartPulse, rest: Wind, charge: Crosshair, curse: Skull, drain: HeartPulse,
	roar: AudioLines, summon: PawPrint, dodge: Wind, debuff: CircleDashed, quake: Zap, mimic: Sparkles,
	bite: Swords, claw: Swords, slash: Swords, rapid: Swords, pierce: Swords, heavy: Swords, shot: Crosshair, return: CircleDashed
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

function interpolate(progress: Animated.Value, frames: readonly number[]): Animated.AnimatedInterpolation<number> {
	return progress.interpolate({inputRange: FIGHT_EFFECT_FRAMES, outputRange: [...frames], extrapolate: "clamp"});
}

function ParticleImage({particle, cue, color}: {particle: FightParticle; cue: FightCue; color: string}): ReactNode {
	const size = Math.min(particle.width, particle.height);
	if (particle.form === FIGHT_PARTICLE_FORMS.SPARK) return <Sparkles size={size} color={color} />;
	if (particle.form !== FIGHT_PARTICLE_FORMS.GLYPH) return null;
	const emoji = AppIcons.getIconOrNull(`fightActions.${cue.actionId}`);
	const Icon = EFFECT_ICONS[cue.motion];
	return emoji ? <TwemojiIcon emoji={emoji} size={size} /> : <Icon size={size} color={color} />;
}

function AnimatedParticle({particle, cue, progress, width}: EffectProps & {particle: FightParticle}): ReactNode {
	const direction = cue.actor === "self" ? 1 : -1;
	const miss = cue.missed && !cue.periodic ? direction * MISS_OFFSET : 0;
	const source = width * FIGHT_EFFECT_LAYOUT.anchors[cue.actor];
	const target = width * FIGHT_EFFECT_LAYOUT.anchors[cue.target] + miss;
	const origin = particle.anchor === "actor" ? source : target;
	const horizontal = (particle.x ?? REST_FRAMES).map((offset, index) => origin + direction * offset + (target - source) * (particle.travel?.[index] ?? 0));
	const color = particle.light ? Theme.colors.paper : cue.color;
	const filled = particle.form === FIGHT_PARTICLE_FORMS.STREAK || particle.form === FIGHT_PARTICLE_FORMS.SHARD || particle.form === FIGHT_PARTICLE_FORMS.MOTE;
	const shape = particle.form === FIGHT_PARTICLE_FORMS.GLYPH || particle.form === FIGHT_PARTICLE_FORMS.SPARK ? null : styles[particle.form];
	return <Animated.View testID={`fight-particle-${particle.id}`} style={[styles.particle, shape, {
		width: particle.width, height: particle.height, top: FIGHT_EFFECT_LAYOUT.centerY - particle.height / 2, left: -particle.width / 2,
		borderColor: color, ...(filled ? {backgroundColor: color} : {}), opacity: interpolate(progress, particle.opacity),
		transform: [{translateX: interpolate(progress, horizontal)}, {translateY: interpolate(progress, particle.y ?? REST_FRAMES)}, {rotate: progress.interpolate({inputRange: FIGHT_EFFECT_FRAMES, outputRange: (particle.rotation ?? REST_FRAMES).map(angle => `${angle * direction}deg`)})}, {scale: interpolate(progress, particle.scale ?? SCALE_FRAMES)}]
	}]}><ParticleImage particle={particle} cue={cue} color={color} /></Animated.View>;
}

export function FightActionEffects({choreography, ...props}: EffectProps & {choreography: FightChoreography}): ReactNode {
	return choreography.filter(particle => !particle.onHit || !props.cue.missed).map(particle => <AnimatedParticle key={particle.id} particle={particle} {...props} />);
}