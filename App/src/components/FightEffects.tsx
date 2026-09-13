import {ReactNode} from "react";
import {Animated, StyleSheet, View} from "react-native";
import {Crosshair, Droplets, Flame, HeartPulse, Shield, Snowflake, Sparkles, Wind, Zap, Skull, Swords, CircleDashed, Waves, PawPrint, AudioLines} from "lucide-react-native";
import {FightCue, FightImpact, FightMotion, FIGHT_MOTIONS} from "@/src/display/FightMotion";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {useCompactFight} from "@/src/components/FightControls";

export const FIGHT_ANIMATION_FRAMES = [0, 0.18, 0.38, 0.58, 0.8, 1];
const STAGE_ANCHORS = {self: 0.235, opponent: 0.765};
const EFFECT_Y = 76;
const EFFECT_SIZE = 54;
const SLASH_MOTIONS = new Set<FightMotion>([FIGHT_MOTIONS.SLASH, FIGHT_MOTIONS.RAPID, FIGHT_MOTIONS.PIERCE, FIGHT_MOTIONS.CLAW]);
const TRAVEL_MOTIONS = new Set<FightMotion>([FIGHT_MOTIONS.SHOT, FIGHT_MOTIONS.RETURN, FIGHT_MOTIONS.FLAME, FIGHT_MOTIONS.FROST, FIGHT_MOTIONS.WAVE, FIGHT_MOTIONS.POISON, FIGHT_MOTIONS.DRAIN, FIGHT_MOTIONS.CURSE]);
const EFFECT_ICONS = {
	flame: Flame, frost: Snowflake, lightning: Zap, wave: Waves, poison: Droplets, shield: Shield,
	blessing: Sparkles, heal: HeartPulse, rest: Wind, charge: Crosshair, curse: Skull, drain: HeartPulse,
	roar: AudioLines, summon: PawPrint, dodge: Wind, debuff: CircleDashed, quake: Zap, mimic: Sparkles,
	bite: Swords, claw: Swords, slash: Swords, rapid: Swords, pierce: Swords, heavy: Swords, shot: Crosshair, return: CircleDashed
} as const;

const styles = StyleSheet.create({
	layer: {...StyleSheet.absoluteFill, zIndex: 3},
	glyph: {position: "absolute", width: EFFECT_SIZE, height: EFFECT_SIZE, alignItems: "center", justifyContent: "center"},
	slash: {position: "absolute", top: 46, width: 5, height: 78, borderRadius: 3},
	ring: {position: "absolute", width: 82, height: 82, borderRadius: 41, borderWidth: 2},
	flash: {position: "absolute", top: 27, bottom: 70, width: "43%", borderRadius: Theme.radius},
	impact: {position: "absolute", minWidth: 88, alignItems: "center", top: 36},
	amount: {fontFamily: Theme.fonts.extraBold, fontSize: 24, lineHeight: 30, textAlign: "center", textShadowColor: Theme.colors.paper, textShadowRadius: 4, textShadowOffset: {width: 0, height: 1}},
	critical: {fontFamily: Theme.fonts.bold, fontSize: 9, color: Theme.colors.red, backgroundColor: Theme.colors.paper, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4},
	miss: {position: "absolute", top: 122, width: 112, textAlign: "center", fontFamily: Theme.fonts.bold, fontSize: 12, color: Theme.colors.muted},
	ray: {position: "absolute", width: 3, height: 16, borderRadius: 2},
	lightning: {position: "absolute", top: 24}
});

type EffectProps = {cue: FightCue; progress: Animated.Value; width: number};

function effectOpacity(progress: Animated.Value): Animated.AnimatedInterpolation<number> {
	return progress.interpolate({inputRange: [0, 0.12, 0.45, 0.9, 1], outputRange: [0, 1, 1, 0, 0]});
}

function SlashEffect({cue, progress, width}: EffectProps): ReactNode {
	const center = width * STAGE_ANCHORS[cue.target];
	const count = cue.motion === FIGHT_MOTIONS.CLAW ? 3 : cue.motion === FIGHT_MOTIONS.RAPID ? 2 : 1;
	const direction = cue.actor === "self" ? 1 : -1;
	return Array.from({length: count}, (_, index) => <Animated.View key={index} style={[styles.slash, {
		left: center - 20 + index * 12, backgroundColor: cue.color, opacity: effectOpacity(progress),
		transform: [{translateX: progress.interpolate({inputRange: [0, 0.4, 1], outputRange: [-30 * direction, 8 * direction, 36 * direction]})}, {rotate: cue.motion === FIGHT_MOTIONS.PIERCE ? "70deg" : `${direction * 32}deg`}, {scaleY: progress.interpolate({inputRange: [0, 0.3, 1], outputRange: [0.2, 1.15, 0.25]})}]
	}]} />);
}

function TravelingEffect({cue, progress, width}: EffectProps): ReactNode {
	const drain = cue.motion === FIGHT_MOTIONS.DRAIN;
	const source = width * STAGE_ANCHORS[drain ? cue.target : cue.actor] - EFFECT_SIZE / 2;
	const target = width * STAGE_ANCHORS[drain ? cue.actor : cue.target] - EFFECT_SIZE / 2;
	const Icon = EFFECT_ICONS[cue.motion];
	const emoji = AppIcons.getIconOrNull(`fightActions.${cue.actionId}`);
	const useActionIcon = cue.motion === FIGHT_MOTIONS.SHOT || cue.motion === FIGHT_MOTIONS.RETURN;
	const destination = cue.motion === FIGHT_MOTIONS.RETURN ? source : target;
	return <Animated.View style={[styles.glyph, {
		top: EFFECT_Y - EFFECT_SIZE / 2, opacity: effectOpacity(progress),
		transform: [
			{translateX: progress.interpolate({inputRange: [0, 0.15, 0.58, 1], outputRange: [source, source, target, destination]})},
			{translateY: progress.interpolate({inputRange: [0, 0.4, 0.65, 1], outputRange: [8, -16, 0, 10]})},
			{rotate: progress.interpolate({inputRange: [0, 1], outputRange: ["0deg", cue.motion === FIGHT_MOTIONS.RETURN ? "360deg" : "-12deg"]})},
			{scale: progress.interpolate({inputRange: [0, 0.2, 0.65, 1], outputRange: [0.35, 0.8, 1.25, 0.3]})}
		]
	}]}>{useActionIcon && emoji ? <TwemojiIcon emoji={emoji} size={40} /> : <Icon size={42} color={cue.color} strokeWidth={2.4} />}</Animated.View>;
}

function PulseEffect({cue, progress, width}: EffectProps): ReactNode {
	const center = width * STAGE_ANCHORS[cue.target];
	const Icon = EFFECT_ICONS[cue.motion];
	return <>
		<Animated.View style={[styles.ring, {left: center - 41, top: EFFECT_Y - 41, borderColor: cue.color, opacity: progress.interpolate({inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0]}), transform: [{scale: progress.interpolate({inputRange: [0, 1], outputRange: [0.45, 1.6]})}]}]} />
		<Animated.View style={[styles.glyph, {left: center - EFFECT_SIZE / 2, top: EFFECT_Y - EFFECT_SIZE / 2, opacity: effectOpacity(progress), transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [8, -20]})}, {scale: progress.interpolate({inputRange: [0, 0.4, 1], outputRange: [0.5, 1.25, 0.95]})}]}]}><Icon size={46} color={cue.color} strokeWidth={1.7} /></Animated.View>
	</>;
}

function ImpactBurst({cue, progress, width}: EffectProps): ReactNode {
	const center = width * STAGE_ANCHORS[cue.target];
	return <>
		{Array.from({length: 6}, (_, index) => {
			const angle = index * Math.PI / 3;
			return <Animated.View key={index} style={[styles.ray, {left: center, top: EFFECT_Y, backgroundColor: cue.color, opacity: progress.interpolate({inputRange: [0, 0.28, 0.4, 1], outputRange: [0, 0, 1, 0]}), transform: [{translateX: progress.interpolate({inputRange: [0, 0.3, 1], outputRange: [0, 0, Math.cos(angle) * 52]})}, {translateY: progress.interpolate({inputRange: [0, 0.3, 1], outputRange: [0, 0, Math.sin(angle) * 46]})}, {rotate: `${index * 60}deg`}]}]} />;
		})}
		{cue.motion === FIGHT_MOTIONS.LIGHTNING ? <Animated.View style={[styles.lightning, {left: center - 27, opacity: effectOpacity(progress), transform: [{scaleY: progress.interpolate({inputRange: [0, 0.3, 1], outputRange: [0.1, 1.6, 0.4]})}]}]}><Zap size={54} color={cue.color} fill={cue.color} /></Animated.View> : null}
	</>;
}

function ActionEffect(props: EffectProps): ReactNode {
	if (props.cue.periodic) return <PulseEffect {...props} />;
	if (SLASH_MOTIONS.has(props.cue.motion)) return <SlashEffect {...props} />;
	if (TRAVEL_MOTIONS.has(props.cue.motion)) return <TravelingEffect {...props} />;
	return <PulseEffect {...props} />;
}

function ImpactNumber({impact, cue, progress, width, position}: EffectProps & {impact: FightImpact; position: number}): ReactNode {
	const negative = impact.kind === "damage" ? impact.amount > 0 : impact.amount < 0;
	const color = negative ? Theme.colors.red : impact.kind === "breath" ? Theme.colors.blue : Theme.colors.green;
	const amount = `${negative ? "-" : "+"}${formatNumber(Math.abs(impact.amount))}`;
	return <Animated.View style={[styles.impact, {left: width * STAGE_ANCHORS[impact.side] - 44, opacity: progress.interpolate({inputRange: [0, 0.32, 0.42, 0.8, 1], outputRange: [0, 0, 1, 1, 0]}), transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [position * 25, position * 25 - 34]})}, {scale: progress.interpolate({inputRange: [0, 0.4, 0.6, 1], outputRange: [0.6, 1.15, 1, 1]})}]}]}>
		{cue.critical && position === 0 ? <Animated.Text style={styles.critical}>{i18n.t("app:battle.critical")}</Animated.Text> : null}
		<Animated.Text style={[styles.amount, {color}]}>{amount}</Animated.Text>
	</Animated.View>;
}

export function FightEffects({cue, progress, width}: EffectProps): ReactNode {
	const impacts = cue.impacts;
	const compact = useCompactFight();
	return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.layer, compact && {transform: [{translateY: -24}]}]} testID={`fight-effect-${cue.motion}`}>
		<ActionEffect cue={cue} progress={progress} width={width} />
		{!cue.missed ? <>
			<Animated.View style={[styles.flash, {left: cue.target === "self" ? "0%" : "57%", backgroundColor: cue.color, opacity: progress.interpolate({inputRange: [0, 0.28, 0.4, 0.64, 1], outputRange: [0, 0, 0.13, 0.04, 0]})}]} />
			{cue.target !== cue.actor ? <ImpactBurst cue={cue} progress={progress} width={width} /> : null}
		</> : <Animated.Text style={[styles.miss, {left: width * STAGE_ANCHORS[cue.target] - 56, opacity: effectOpacity(progress)}]}>{i18n.t("app:battle.missed")}</Animated.Text>}
		{impacts.map((impact, index) => <ImpactNumber key={`${impact.side}:${impact.kind}:${index}`} impact={impact} cue={cue} progress={progress} width={width} position={impacts.slice(0, index).filter(previous => previous.side === impact.side).length} />)}
	</View>;
}