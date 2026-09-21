import {ReactNode, useState} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {Info, Shield, Swords, Wind} from "@/src/design/FightIcons";
import {FightFighter} from "ws-packets/src/objects/Fight";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {ExpandableList, Fact, Sheet} from "@/src/design/Sections";
import {fighterDisplayName, fighterSubtitle, fightActionName} from "@/src/display/Fight";
import {petName} from "@/src/display/PetDisplay";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {useCompactFight} from "@/src/components/FightControls";
import {FightGauge} from "@/src/components/FightGauge";
import {FightAnimation} from "@/src/store/useFightAnimation";
import {FightPortrait} from "@/src/components/FightPortrait";

const COMBAT_STATS = [{key: "attack", Icon: Swords}, {key: "defense", Icon: Shield}, {key: "speed", Icon: Wind}] as const;
const styles = StyleSheet.create({
	participant: {flex: 1, minWidth: 0},
	card: {flex: 1, minHeight: 226, borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius, backgroundColor: Theme.colors.paper, padding: Theme.spacing.md},
	selfCard: {borderTopWidth: 3, borderTopColor: Theme.colors.blue},
	foeCard: {borderTopWidth: 3, borderTopColor: Theme.colors.red},
	roleRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 18},
	role: {fontFamily: Theme.fonts.bold, fontSize: 9, lineHeight: 12, color: Theme.colors.muted, textTransform: "uppercase", letterSpacing: 0},
	name: {fontFamily: Theme.fonts.bold, fontSize: 13, lineHeight: 17, color: Theme.colors.ink, textAlign: "center", minHeight: 34},
	classLabel: {fontFamily: Theme.fonts.regular, fontSize: 10, lineHeight: 14, color: Theme.colors.muted, textAlign: "center", minHeight: 28},
	energy: {marginTop: 9},
	statRow: {flexDirection: "row", justifyContent: "space-around", paddingVertical: Theme.spacing.md, gap: Theme.spacing.md},
	stat: {alignItems: "center", gap: 7},
	statValue: {fontFamily: Theme.fonts.bold, fontSize: 18, color: Theme.colors.ink},
	statLabel: {fontFamily: Theme.fonts.regular, fontSize: 11, color: Theme.colors.muted},
	liveStats: {flexDirection: "row", gap: 4, paddingVertical: 8, marginTop: 7, borderTopWidth: 1, borderTopColor: Theme.colors.line},
	liveStat: {flex: 1, minWidth: 0, alignItems: "center", gap: 3},
	liveValue: {fontFamily: Theme.fonts.bold, fontSize: 12, lineHeight: 16, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	liveLabel: {fontFamily: Theme.fonts.regular, fontSize: 9, lineHeight: 12, color: Theme.colors.muted},
	breath: {flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", columnGap: 4, rowGap: 2},
	breathValue: {fontFamily: Theme.fonts.semiBold, fontSize: 10, lineHeight: 14, color: Theme.colors.blue, fontVariant: ["tabular-nums"]},
	compactCard: {minHeight: 148, padding: 8},
	compactRole: {minHeight: 14},
	compactName: {minHeight: 17},
	compactClass: {minHeight: 14}
});

function FighterIdentity({fighter, compact}: {fighter: FightFighter; compact: boolean}): ReactNode {
	return <><Text style={[styles.name, compact && styles.compactName]} numberOfLines={2}>{fighterDisplayName(fighter)}</Text><Text style={[styles.classLabel, compact && styles.compactClass]} numberOfLines={2}>{fighterSubtitle(fighter)}</Text></>;
}

function FighterCombatStats({fighter}: {fighter: FightFighter}): ReactNode {
	const side = fighter.isSelf ? "self" : "opponent";
	return <>
		<View style={styles.liveStats}>{COMBAT_STATS.map(({key, Icon}) => <View key={key} style={styles.liveStat} testID={`fight-stat-${key}-${side}`}>
			<Icon size={13} color={Theme.colors.muted} />
			<Text style={styles.liveValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{formatNumber(fighter.stats[key])}</Text>
			<Text style={styles.liveLabel} numberOfLines={1} adjustsFontSizeToFit>{i18n.t(`app:arena.stats.${key}`)}</Text>
		</View>)}</View>
		<View style={styles.breath} testID={`fight-stat-breath-${side}`}><Text style={styles.liveLabel}>{i18n.t("app:arena.breath")}</Text><Text style={styles.breathValue}>{i18n.t("app:profile.formats.progress", {value: fighter.stats.breath, max: fighter.stats.maxBreath})}</Text></View>
		<Text style={styles.liveLabel}>{i18n.t("app:battle.breathRegen", {count: fighter.stats.breathRegen})}</Text>
	</>;
}

function FighterStats({fighter, pet, onClose}: {fighter: FightFighter; pet?: OwnedPet; onClose: () => void}): ReactNode {
	return <Sheet
		caption={i18n.t("app:arena.details")}
		title={fighterDisplayName(fighter)}
		closeLabel={i18n.t("app:common.back")}
		onClose={onClose}
	>
		<View style={styles.statRow}>{COMBAT_STATS.map(({key, Icon}) => <View key={key} style={styles.stat}><Icon size={22} color={Theme.colors.muted} /><Text style={styles.statValue}>{formatNumber(fighter.stats[key])}</Text><Text style={styles.statLabel}>{i18n.t(`app:arena.stats.${key}`)}</Text></View>)}</View>
		<ExpandableList>
			<Fact label={i18n.t("app:arena.breath")} value={i18n.t("app:profile.formats.progress", {value: fighter.stats.breath, max: fighter.stats.maxBreath})} />
			<Fact label={i18n.t("app:arena.stats.breathRegen")} value={formatNumber(fighter.stats.breathRegen)} />
			{fighter.alteration ? <Fact label={i18n.t("app:arena.effects.newAlteration")} value={fightActionName(fighter.alteration)} /> : null}
			{fighter.glory === undefined ? null : <Fact label={i18n.t("app:arena.glory")} value={formatNumber(fighter.glory)} />}
			{pet ? <Fact label={i18n.t("app:arena.pet")} value={petName(pet)} /> : null}
		</ExpandableList>
	</Sheet>;
}

function FighterRole({fighter, compact}: {fighter: FightFighter; compact: boolean}): ReactNode {
	const alterationIcon = fighter.alteration ? AppIcons.getIconOrNull(`fightActions.${fighter.alteration}`) : null;
	return <View style={[styles.roleRow, compact && styles.compactRole]}><Text style={styles.role}>{i18n.t(fighter.isSelf ? "app:arena.you" : "app:arena.opponent")}</Text>{alterationIcon ? <View accessible accessibilityLabel={fightActionName(fighter.alteration!)}><TwemojiIcon emoji={alterationIcon} size={14} /></View> : null}<Info size={13} color={Theme.colors.faint} /></View>;
}

export function FightFighterCard({fighter, pet, animation}: {fighter: FightFighter; pet?: OwnedPet; animation: FightAnimation}): ReactNode {
	const [expanded, setExpanded] = useState(false);
	const compact = useCompactFight();
	return <View style={styles.participant} testID={`fight-fighter-${fighter.isSelf ? "self" : "opponent"}`}>
		<Pressable accessibilityRole="button" accessibilityLabel={`${i18n.t("app:arena.details")} : ${fighterDisplayName(fighter)}`} onPress={(): void => setExpanded(true)} style={[styles.card, fighter.isSelf ? styles.selfCard : styles.foeCard, compact && styles.compactCard]}>
			<FighterRole fighter={fighter} compact={compact} />
			<FightPortrait fighter={fighter} pet={pet} animation={animation} />
			<FighterIdentity fighter={fighter} compact={compact} />
			<View style={styles.energy}><FightGauge label={i18n.t("app:arena.energy")} value={fighter.stats.power} max={fighter.stats.maxEnergy} color={fighter.isSelf ? Theme.colors.green : Theme.colors.red} reducedMotion={animation.reducedMotion} /></View>
			<FighterCombatStats fighter={fighter} />
		</Pressable>
		{expanded ? <FighterStats fighter={fighter} pet={pet} onClose={(): void => setExpanded(false)} /> : null}
	</View>;
}