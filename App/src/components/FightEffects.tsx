import {ReactNode} from "react";
import {Animated, StyleSheet, View} from "react-native";
import {FightCue, FightImpact} from "@/src/display/FightMotion";
import {Theme} from "@/src/design/Theme";
import {fightImpactLabel} from "@/src/display/Fight";
import {i18n} from "@/src/translations/i18n";
import {useCompactFight} from "@/src/components/FightControls";
import {fightChoreography, FIGHT_EFFECT_LAYOUT} from "@/src/display/FightChoreography";
import {FightActionEffects} from "@/src/components/FightActionEffects";

const styles = StyleSheet.create({
	layer: {...StyleSheet.absoluteFill, zIndex: 3, overflow: "hidden"},
	flash: {position: "absolute", top: 27, bottom: 70, width: "43%", borderRadius: Theme.radius},
	impact: {position: "absolute", minWidth: 88, alignItems: "center", top: 72},
	amount: {fontFamily: Theme.fonts.extraBold, fontSize: 24, lineHeight: 30, textAlign: "center", textShadowColor: Theme.colors.paper, textShadowRadius: 4, textShadowOffset: {width: 0, height: 1}},
	critical: {fontFamily: Theme.fonts.bold, fontSize: 9, color: Theme.colors.red, backgroundColor: Theme.colors.paper, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4},
	miss: {position: "absolute", top: 122, width: 112, textAlign: "center", fontFamily: Theme.fonts.bold, fontSize: 12, color: Theme.colors.muted}
});

type EffectProps = {cue: FightCue; progress: Animated.Value; width: number};

function effectOpacity(progress: Animated.Value): Animated.AnimatedInterpolation<number> {
	return progress.interpolate({inputRange: [0, 0.12, 0.45, 0.9, 1], outputRange: [0, 1, 1, 0, 0]});
}

function ImpactNumber({impact, cue, progress, width, position}: EffectProps & {impact: FightImpact; position: number}): ReactNode {
	const negative = impact.kind === "damage" ? impact.amount > 0 : impact.amount < 0;
	const color = negative ? Theme.colors.red : impact.kind === "breath" ? Theme.colors.blue : Theme.colors.green;
	const amount = fightImpactLabel(impact);
	return <Animated.View style={[styles.impact, {left: width * FIGHT_EFFECT_LAYOUT.anchors[impact.side] - 44, opacity: progress.interpolate({inputRange: [0, 0.32, 0.42, 0.8, 1], outputRange: [0, 0, 1, 1, 0]}), transform: [{translateY: progress.interpolate({inputRange: [0, 1], outputRange: [position * 25, position * 25 - 34]})}, {scale: progress.interpolate({inputRange: [0, 0.4, 0.6, 1], outputRange: [0.6, 1.15, 1, 1]})}]}]}>
		{cue.critical && position === 0 ? <Animated.Text style={styles.critical}>{i18n.t("app:battle.critical")}</Animated.Text> : null}
		<Animated.Text style={[styles.amount, {color}]}>{amount}</Animated.Text>
	</Animated.View>;
}

export function FightEffects({cue, progress, width}: EffectProps): ReactNode {
	const impacts = cue.impacts;
	const compact = useCompactFight();
	return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.layer, compact && {transform: [{translateY: -24}]}]} testID={`fight-effect-${cue.motion}`}>
		<FightActionEffects cue={cue} progress={progress} width={width} choreography={fightChoreography(cue)} />
		{!cue.missed ?
			<Animated.View style={[styles.flash, {left: cue.target === "self" ? "0%" : "57%", backgroundColor: cue.color, opacity: progress.interpolate({inputRange: [0, 0.28, 0.4, 0.64, 1], outputRange: [0, 0, 0.13, 0.04, 0]})}]} />
			: <Animated.Text style={[styles.miss, {left: width * FIGHT_EFFECT_LAYOUT.anchors[cue.target] - 56, opacity: effectOpacity(progress)}]}>{i18n.t("app:battle.missed")}</Animated.Text>}
		{impacts.map((impact, index) => <ImpactNumber key={`${impact.source}:${impact.kind}`} impact={impact} cue={cue} progress={progress} width={width} position={impacts.slice(0, index).filter(previous => previous.side === impact.side).length} />)}
	</View>;
}