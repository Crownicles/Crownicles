import {ReactNode, useEffect, useEffectEvent, useState} from "react";
import {Animated, Easing, Pressable, StyleSheet, Text, View} from "react-native";
import {Info, Shield, Swords, Wind, LucideIcon} from "lucide-react-native";
import {FightFighter, FightIntroduction, FightStatus} from "ws-packets/src/objects/Fight";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {FightLogRecord} from "@/src/store/FightStore";
import {FightCue, FightMotion, FightSide, FIGHT_MOTIONS, fightCue} from "@/src/display/FightMotion";
import {FightEffects, FIGHT_ANIMATION_FRAMES} from "@/src/components/FightEffects";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Button, ButtonRow, Confirmation, KeyValue} from "@/src/design/Primitives";
import {fighterName} from "@/src/display/Fight";
import {petIcon, petName} from "@/src/display/PetDisplay";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {useCompactFight} from "@/src/components/FightControls";

const ANIMATION_DURATION = 780;
const HEAVY_ANIMATION_DURATION = 920;
const REDUCED_ANIMATION_DURATION = 120;
const GAUGE_DURATION = 360;
const IMPACT_PROGRESS = 0.4;
const CONTACT_MOTIONS = new Set<FightMotion>([FIGHT_MOTIONS.SLASH, FIGHT_MOTIONS.RAPID, FIGHT_MOTIONS.HEAVY, FIGHT_MOTIONS.BITE, FIGHT_MOTIONS.CLAW, FIGHT_MOTIONS.PIERCE, FIGHT_MOTIONS.QUAKE]);
const styles = StyleSheet.create({
	stage: {position: "relative"},
	participants: {flexDirection: "row", gap: Theme.spacing.md},
	participant: {flex: 1, minWidth: 0},
	card: {minHeight: 226, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius, backgroundColor: Theme.colors.paper, padding: Theme.spacing.md},
	selfCard: {borderTopWidth: 3, borderTopColor: Theme.colors.blue},
	foeCard: {borderTopWidth: 3, borderTopColor: Theme.colors.red},
	roleRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 18},
	role: {fontFamily: Theme.fonts.bold, fontSize: 9, lineHeight: 12, color: Theme.colors.muted, textTransform: "uppercase", letterSpacing: 0},
	portrait: {width: 72, height: 70, alignSelf: "center", marginTop: 10, marginBottom: 7, alignItems: "center", justifyContent: "center"},
	portraitBase: {position: "absolute", bottom: 0, width: 62, height: 10, borderRadius: 5, backgroundColor: Theme.colors.wash},
	pet: {position: "absolute", right: -9, bottom: 2, borderRadius: 10, backgroundColor: Theme.colors.paper, padding: 3, borderWidth: 1, borderColor: Theme.colors.line},
	name: {fontFamily: Theme.fonts.bold, fontSize: 13, lineHeight: 17, color: Theme.colors.ink, textAlign: "center", minHeight: 34},
	classLabel: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 14, color: Theme.colors.muted, textAlign: "center", minHeight: 28},
	versus: {position: "absolute", top: 66, left: "50%", marginLeft: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: Theme.colors.paper, borderWidth: 1, borderColor: Theme.colors.line, alignItems: "center", justifyContent: "center", zIndex: 2},
	versusText: {fontFamily: Theme.fonts.extraBold, fontSize: 10, color: Theme.colors.faint},
	energy: {marginTop: 9},
	barTop: {flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 4, marginBottom: 6},
	barLabel: {fontFamily: Theme.fonts.medium, fontSize: 10, color: Theme.colors.muted},
	barValue: {fontFamily: Theme.fonts.bold, fontSize: 11, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	track: {height: 6, backgroundColor: Theme.colors.line, borderRadius: 3, overflow: "hidden"},
	fill: {height: "100%", borderRadius: 3},
	resource: {marginTop: Theme.spacing.md, padding: Theme.spacing.md, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius, backgroundColor: Theme.colors.wash},
	resourceHeader: {flexDirection: "row", alignItems: "center", gap: 6},
	resourceTitle: {fontFamily: Theme.fonts.semiBold, fontSize: 12, color: Theme.colors.ink},
	regen: {fontFamily: Theme.fonts.regular, fontSize: 10, color: Theme.colors.muted, marginTop: 6},
	alteration: {flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 7, minHeight: 16},
	alterationText: {flexShrink: 1, fontFamily: Theme.fonts.medium, fontSize: 10, color: Theme.colors.muted},
	statRow: {flexDirection: "row", justifyContent: "space-around", paddingVertical: Theme.spacing.md, gap: Theme.spacing.md},
	stat: {alignItems: "center", gap: 7},
	statValue: {fontFamily: Theme.fonts.bold, fontSize: 18, color: Theme.colors.ink},
	statLabel: {fontFamily: Theme.fonts.regular, fontSize: 11, color: Theme.colors.muted},
	compactCard: {minHeight: 148, padding: 8},
	compactRole: {minHeight: 14},
	compactPortrait: {height: 40, marginTop: 3, marginBottom: 5},
	compactName: {minHeight: 17},
	compactClass: {minHeight: 14},
	compactVersus: {top: 40},
	compactResource: {padding: 9, marginTop: 8},
	meterLabel: {flexDirection: "row", alignItems: "center", gap: 5}
});

export function FightGauge({label, value, max, color, reducedMotion = false, icon: Icon}: {label: string; value: number; max?: number; color: string; reducedMotion?: boolean; icon?: LucideIcon}): ReactNode {
	const ratio = max ? Math.max(0, Math.min(1, value / max)) : 1;
	const [fill] = useState(() => new Animated.Value(ratio));
	useEffect(() => {
		const animation = Animated.timing(fill, {toValue: ratio, duration: reducedMotion ? 0 : GAUGE_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false});
		animation.start();
		return (): void => animation.stop();
	}, [fill, ratio, reducedMotion]);
	return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{now: value, ...(max === undefined ? {} : {max})}}>
		<View style={styles.barTop}><View style={styles.meterLabel}>{Icon ? <Icon size={15} color={color} /> : null}<Text style={Icon ? styles.resourceTitle : styles.barLabel}>{label}</Text></View><Text style={styles.barValue} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>{max === undefined ? formatNumber(value) : i18n.t("app:profile.formats.progress", {value: formatNumber(value), max: formatNumber(max)})}</Text></View>
		<View style={styles.track}><Animated.View style={[styles.fill, {backgroundColor: color, width: fill.interpolate({inputRange: [0, 1], outputRange: ["0%", "100%"]})}]} /></View>
	</View>;
}

function fighterIcon(fighter: FightFighter): string | null {
	if (fighter.monsterId) return AppIcons.getIconOrNull(`monsters.${fighter.monsterId}`);
	return fighter.classId === undefined ? null : AppIcons.getIconOrNull(`classes.${fighter.classId}`);
}

function FighterStats({fighter, pet, onClose}: {fighter: FightFighter; pet?: OwnedPet; onClose: () => void}): ReactNode {
	return <Confirmation title={fighter.name ?? fighterName(fighter)} message={i18n.t("app:arena.details")} onRequestClose={onClose}>
		<View style={styles.statRow}>{([{key: "attack", Icon: Swords}, {key: "defense", Icon: Shield}, {key: "speed", Icon: Wind}] as const).map(({key, Icon}) => <View key={key} style={styles.stat}><Icon size={22} color={Theme.colors.muted} /><Text style={styles.statValue}>{formatNumber(fighter.stats[key])}</Text><Text style={styles.statLabel}>{i18n.t(`app:arena.stats.${key}`)}</Text></View>)}</View>
		<KeyValue label={i18n.t("app:arena.breath")} value={i18n.t("app:profile.formats.progress", {value: fighter.stats.breath, max: fighter.stats.maxBreath})} />
		<KeyValue label={i18n.t("app:arena.stats.breathRegen")} value={formatNumber(fighter.stats.breathRegen)} />
		{fighter.glory === undefined ? null : <KeyValue label={i18n.t("app:arena.glory")} value={formatNumber(fighter.glory)} />}
		{pet ? <KeyValue label={i18n.t("app:arena.pet")} value={petName(pet)} /> : null}
		<ButtonRow><Button onPress={onClose}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}

function motionFrames(cue: FightCue | undefined, side: FightSide): number[] {
	if (!cue) return [0, 0, 0, 0, 0, 0];
	const direction = side === "self" ? 1 : -1;
	if (side === cue.target && cue.target !== cue.actor) {
		if (cue.missed) return [0, 0, -10 * direction, -10 * direction, -3 * direction, 0];
		return [0, 0, -10 * direction, 6 * direction, -3 * direction, 0];
	}
	if (side === cue.actor && CONTACT_MOTIONS.has(cue.motion) && !cue.periodic) return [0, -4 * direction, 12 * direction, 5 * direction, -2 * direction, 0];
	return [0, 0, 0, 0, 0, 0];
}

function FighterCard({fighter, pet, cue, progress, reducedMotion}: {fighter: FightFighter; pet?: OwnedPet; cue?: FightCue; progress: Animated.Value; reducedMotion: boolean}): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const compact = useCompactFight();
	const side = fighter.isSelf ? "self" : "opponent";
	const icon = fighterIcon(fighter);
	const classLabel = fighter.classId === undefined ? "" : i18n.t(`models:classes.${fighter.classId}`);
	const level = fighter.level === undefined ? "" : i18n.t("app:battle.level", {level: fighter.level});
	const alterationIcon = fighter.alteration ? AppIcons.getIconOrNull(`fightActions.${fighter.alteration}`) : null;
	const frames = motionFrames(cue, side);
	const heavy = cue?.motion === FIGHT_MOTIONS.HEAVY || cue?.motion === FIGHT_MOTIONS.QUAKE;
	return <Animated.View style={[styles.participant, !reducedMotion && {transform: [{translateX: progress.interpolate({inputRange: FIGHT_ANIMATION_FRAMES, outputRange: frames})}, {scale: progress.interpolate({inputRange: FIGHT_ANIMATION_FRAMES, outputRange: heavy && cue?.target === side ? [1, 1, 0.95, 1.03, 0.99, 1] : [1, 1, 1, 1, 1, 1]})}]}]} testID={`fight-fighter-${side}`}>
		<Pressable accessibilityRole="button" accessibilityLabel={`${i18n.t("app:arena.details")} : ${fighter.name ?? fighterName(fighter)}`} onPress={(): void => setExpanded(true)} style={[styles.card, fighter.isSelf ? styles.selfCard : styles.foeCard, compact && styles.compactCard]}>
			<View style={[styles.roleRow, compact && styles.compactRole]}><Text style={styles.role}>{i18n.t(fighter.isSelf ? "app:arena.you" : "app:arena.opponent")}</Text><Info size={13} color={Theme.colors.faint} /></View>
			<View style={[styles.portrait, compact && styles.compactPortrait]}><View style={styles.portraitBase} />{icon ? <TwemojiIcon emoji={icon} size={compact ? 36 : 55} /> : <Swords size={compact ? 30 : 44} color={fighter.isSelf ? Theme.colors.blue : Theme.colors.red} />}{pet ? <View style={styles.pet}><TwemojiIcon emoji={petIcon(pet)} size={compact ? 14 : 20} /></View> : null}</View>
			<Text style={[styles.name, compact && styles.compactName]} numberOfLines={2}>{fighter.name ?? fighterName(fighter)}</Text>
			<Text style={[styles.classLabel, compact && styles.compactClass]} numberOfLines={2}>{[classLabel, level].filter(Boolean).join(" · ")}</Text>
			<View style={styles.energy}><FightGauge label={i18n.t("app:arena.energy")} value={fighter.stats.power} max={fighter.stats.maxEnergy} color={fighter.isSelf ? Theme.colors.green : Theme.colors.red} reducedMotion={reducedMotion} /></View>
			{fighter.alteration ? <View style={styles.alteration}>{alterationIcon ? <TwemojiIcon emoji={alterationIcon} size={13} /> : null}<Text style={styles.alterationText} numberOfLines={1}>{i18n.t(`models:fight_actions.${fighter.alteration}.name`, {defaultValue: fighter.alteration})}</Text></View> : null}
		</Pressable>
		{expanded ? <FighterStats fighter={fighter} pet={pet} onClose={(): void => setExpanded(false)} /> : null}
	</Animated.View>;
}

export function FightBreath({fighter, reducedMotion}: {fighter: FightFighter; reducedMotion: boolean}): ReactNode {
	const compact = useCompactFight();
	return <View style={[styles.resource, compact && styles.compactResource]}>
		<FightGauge icon={Wind} label={i18n.t("app:arena.breath")} value={fighter.stats.breath} max={fighter.stats.maxBreath} color={Theme.colors.blue} reducedMotion={reducedMotion} />
		<Text style={styles.regen}>{i18n.t("app:battle.breathRegen", {count: fighter.stats.breathRegen})}</Text>
	</View>;
}

export function FightStage({status, introduction, record, onImpact, onComplete, reducedMotion}: {status: FightStatus; introduction: FightIntroduction | null; record?: FightLogRecord; onImpact: () => void; onComplete: () => void; reducedMotion: boolean}): ReactNode {
	const compact = useCompactFight();
	const [progress] = useState(() => new Animated.Value(0));
	const [width, setWidth] = useState(350);
	const finish = useEffectEvent(onComplete);
	const hit = useEffectEvent(onImpact);
	const cue = record ? fightCue(record.entry) : undefined;
	const motion = cue?.motion;
	const sequence = record?.sequence;
	useEffect(() => {
		progress.setValue(0);
		if (sequence === undefined) return;
		let impacted = false;
		const listener = progress.addListener(({value}) => {
			if (impacted || value < IMPACT_PROGRESS) return;
			impacted = true;
			hit();
		});
		const duration = motion === FIGHT_MOTIONS.HEAVY || motion === FIGHT_MOTIONS.QUAKE ? HEAVY_ANIMATION_DURATION : ANIMATION_DURATION;
		const animation = Animated.timing(progress, {toValue: 1, duration: reducedMotion ? REDUCED_ANIMATION_DURATION : duration, easing: Easing.linear, useNativeDriver: true});
		animation.start(({finished}) => {if (finished) finish();});
		return (): void => {progress.removeListener(listener); animation.stop();};
	}, [sequence, motion, progress, reducedMotion]);
	const self = status.activeFighter.isSelf ? status.activeFighter : status.defendingFighter;
	const opponent = status.activeFighter.isSelf ? status.defendingFighter : status.activeFighter;
	return <View style={styles.stage} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
		<View style={styles.participants}><FighterCard fighter={self} pet={introduction?.initiatorPet} cue={cue} progress={progress} reducedMotion={reducedMotion} /><FighterCard fighter={opponent} pet={introduction?.opponentPet} cue={cue} progress={progress} reducedMotion={reducedMotion} /></View>
		<View style={[styles.versus, compact && styles.compactVersus]}><Text style={styles.versusText}>{i18n.t("app:battle.versus")}</Text></View>
		{cue && !reducedMotion ? <FightEffects cue={cue} progress={progress} width={width} /> : null}
	</View>;
}