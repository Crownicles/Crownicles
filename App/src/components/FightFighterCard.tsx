import {ReactNode, useState} from "react";
import {Animated, Pressable, StyleSheet, Text, View} from "react-native";
import {Info, Shield, Swords, Wind} from "@/src/design/FightIcons";
import {FightFighter} from "ws-packets/src/objects/Fight";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Button, ButtonRow, Confirmation, KeyValue} from "@/src/design/Primitives";
import {fighterDisplayName, fighterSubtitle, fightActionName} from "@/src/display/Fight";
import {petIcon, petName} from "@/src/display/PetDisplay";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {useCompactFight} from "@/src/components/FightControls";
import {FightGauge} from "@/src/components/FightGauge";
import {FightAnimation} from "@/src/store/useFightAnimation";
import {fighterMotionFrames, fighterScaleFrames, fighterTiltFrames, fighterLiftFrames, fighterTimingFrames} from "@/src/display/FightTrajectories";

const styles = StyleSheet.create({
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
	energy: {marginTop: 9},
	statRow: {flexDirection: "row", justifyContent: "space-around", paddingVertical: Theme.spacing.md, gap: Theme.spacing.md},
	stat: {alignItems: "center", gap: 7},
	statValue: {fontFamily: Theme.fonts.bold, fontSize: 18, color: Theme.colors.ink},
	statLabel: {fontFamily: Theme.fonts.regular, fontSize: 11, color: Theme.colors.muted},
	compactCard: {minHeight: 148, padding: 8},
	compactRole: {minHeight: 14},
	compactPortrait: {height: 40, marginTop: 3, marginBottom: 5},
	compactName: {minHeight: 17},
	compactClass: {minHeight: 14}
});

function fighterIcon(fighter: FightFighter): string | null {
	if (fighter.monsterId) return AppIcons.getIconOrNull(`monsters.${fighter.monsterId}`);
	return fighter.classId === undefined ? null : AppIcons.getIconOrNull(`classes.${fighter.classId}`);
}

function FighterPortrait({fighter, pet, compact}: {fighter: FightFighter; pet?: OwnedPet; compact: boolean}): ReactNode {
	const icon = fighterIcon(fighter);
	const sizes = compact ? {fighter: 36, pet: 14} : {fighter: 55, pet: 20};
	return <View style={[styles.portrait, compact && styles.compactPortrait]}><View style={styles.portraitBase} />
		{icon ? <TwemojiIcon emoji={icon} size={sizes.fighter} /> : <Swords size={sizes.fighter} color={Theme.colors.muted} />}
		{pet ? <View style={styles.pet}><TwemojiIcon emoji={petIcon(pet)} size={sizes.pet} /></View> : null}
	</View>;
}

function FighterIdentity({fighter, compact}: {fighter: FightFighter; compact: boolean}): ReactNode {
	return <><Text style={[styles.name, compact && styles.compactName]} numberOfLines={2}>{fighterDisplayName(fighter)}</Text><Text style={[styles.classLabel, compact && styles.compactClass]} numberOfLines={2}>{fighterSubtitle(fighter)}</Text></>;
}

function FighterStats({fighter, pet, onClose}: {fighter: FightFighter; pet?: OwnedPet; onClose: () => void}): ReactNode {
	return <Confirmation title={fighterDisplayName(fighter)} message={i18n.t("app:arena.details")} onRequestClose={onClose}>
		<View style={styles.statRow}>{([{key: "attack", Icon: Swords}, {key: "defense", Icon: Shield}, {key: "speed", Icon: Wind}] as const).map(({key, Icon}) => <View key={key} style={styles.stat}><Icon size={22} color={Theme.colors.muted} /><Text style={styles.statValue}>{formatNumber(fighter.stats[key])}</Text><Text style={styles.statLabel}>{i18n.t(`app:arena.stats.${key}`)}</Text></View>)}</View>
		<KeyValue label={i18n.t("app:arena.breath")} value={i18n.t("app:profile.formats.progress", {value: fighter.stats.breath, max: fighter.stats.maxBreath})} />
		<KeyValue label={i18n.t("app:arena.stats.breathRegen")} value={formatNumber(fighter.stats.breathRegen)} />
		{fighter.alteration ? <KeyValue label={i18n.t("app:arena.effects.newAlteration")} value={fightActionName(fighter.alteration)} /> : null}
		{fighter.glory === undefined ? null : <KeyValue label={i18n.t("app:arena.glory")} value={formatNumber(fighter.glory)} />}
		{pet ? <KeyValue label={i18n.t("app:arena.pet")} value={petName(pet)} /> : null}
		<ButtonRow><Button onPress={onClose}>{i18n.t("app:common.back")}</Button></ButtonRow>
	</Confirmation>;
}

function FighterRole({fighter, compact}: {fighter: FightFighter; compact: boolean}): ReactNode {
	const alterationIcon = fighter.alteration ? AppIcons.getIconOrNull(`fightActions.${fighter.alteration}`) : null;
	return <View style={[styles.roleRow, compact && styles.compactRole]}><Text style={styles.role}>{i18n.t(fighter.isSelf ? "app:arena.you" : "app:arena.opponent")}</Text>{alterationIcon ? <View accessible accessibilityLabel={fightActionName(fighter.alteration!)}><TwemojiIcon emoji={alterationIcon} size={14} /></View> : null}<Info size={13} color={Theme.colors.faint} /></View>;
}

function FighterMotion({fighter, animation, children}: {fighter: FightFighter; animation: FightAnimation; children: ReactNode}): ReactNode {
	const side = fighter.isSelf ? "self" : "opponent";
	const {cue, progress, reducedMotion} = animation;
	const scales = fighterScaleFrames(cue, side);
	const timing = fighterTimingFrames(cue, side);
	return <Animated.View style={!reducedMotion && {transform: [{translateX: progress.interpolate({inputRange: timing, outputRange: fighterMotionFrames(cue, side)})}, {translateY: progress.interpolate({inputRange: timing, outputRange: fighterLiftFrames(cue, side)})}, {scale: progress.interpolate({inputRange: timing, outputRange: scales})}, {rotate: progress.interpolate({inputRange: timing, outputRange: fighterTiltFrames(cue, side)})}]}} testID={`fight-portrait-${side}`}>{children}</Animated.View>;
}

export function FightFighterCard({fighter, pet, animation}: {fighter: FightFighter; pet?: OwnedPet; animation: FightAnimation}): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const compact = useCompactFight();
	return <View style={styles.participant} testID={`fight-fighter-${fighter.isSelf ? "self" : "opponent"}`}>
		<Pressable accessibilityRole="button" accessibilityLabel={`${i18n.t("app:arena.details")} : ${fighterDisplayName(fighter)}`} onPress={(): void => setExpanded(true)} style={[styles.card, fighter.isSelf ? styles.selfCard : styles.foeCard, compact && styles.compactCard]}>
			<FighterRole fighter={fighter} compact={compact} />
			<FighterMotion fighter={fighter} animation={animation}><FighterPortrait fighter={fighter} pet={pet} compact={compact} /></FighterMotion>
			<FighterIdentity fighter={fighter} compact={compact} />
			<View style={styles.energy}><FightGauge label={i18n.t("app:arena.energy")} value={fighter.stats.power} max={fighter.stats.maxEnergy} color={fighter.isSelf ? Theme.colors.green : Theme.colors.red} reducedMotion={animation.reducedMotion} /></View>
		</Pressable>
		{expanded ? <FighterStats fighter={fighter} pet={pet} onClose={(): void => setExpanded(false)} /> : null}
	</View>;
}