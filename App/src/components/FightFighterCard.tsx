import {ReactNode, useState} from "react";
import {Pressable, Text, View} from "react-native";
import {Info, Shield, Swords, Wind} from "@/src/design/FightIcons";
import {FightFighter} from "ws-packets/src/objects/Fight";
import {OwnedPet} from "ws-packets/src/objects/OwnedPet";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {ExpandableList, Fact, QuestionSheet} from "@/src/design/Sections";
import {fighterDisplayName, fighterSubtitle, fightActionName} from "@/src/display/Fight";
import {petName} from "@/src/display/PetDisplay";
import {formatNumber} from "@/src/display/Amounts";
import {i18n} from "@/src/translations/i18n";
import {useCompactFight} from "@/src/components/FightControls";
import {FightGauge} from "@/src/components/FightGauge";
import {FightAnimation} from "@/src/store/useFightAnimation";
import {FightPortrait} from "@/src/components/FightPortrait";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const COMBAT_STATS = [{key: "attack", Icon: Swords}, {key: "defense", Icon: Shield}, {key: "speed", Icon: Wind}] as const;
/** Breath is spent a notch at a time, so it is drawn as notches: the player sees at once what they can afford. */
const BREATH_NOTCH_GAP = 2;
const useStyles = createStyles(colors => ({
	participant: {flex: 1, minWidth: 0},
	card: {borderWidth: 1, borderColor: colors.line, borderRadius: Theme.radius, backgroundColor: colors.paper, padding: Theme.spacing.md, gap: Theme.spacing.sm},
	roleRow: {flexDirection: "row", alignItems: "center", gap: 6, minHeight: 18},
	sideMark: {width: 8, height: 8, borderRadius: 4},
	role: {flex: 1, fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.eyebrow, color: colors.muted, textTransform: "uppercase"},
	identity: {alignItems: "center"},
	name: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.rowTitle, lineHeight: 19, color: colors.ink, textAlign: "center"},
	classLabel: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.caption, lineHeight: 16, color: colors.muted, textAlign: "center"},
	statRow: {flexDirection: "row", justifyContent: "space-around", paddingVertical: Theme.spacing.md, gap: Theme.spacing.md},
	stat: {alignItems: "center", gap: 7},
	statValue: {fontFamily: Theme.fonts.bold, fontSize: 18, color: colors.ink},
	statLabel: {fontFamily: Theme.fonts.regular, fontSize: 11, color: colors.muted},
	liveStats: {flexDirection: "row", justifyContent: "space-between", paddingTop: Theme.spacing.xs},
	liveStat: {flexDirection: "row", alignItems: "center", gap: 3, minWidth: 0},
	liveValue: {fontFamily: Theme.fonts.bold, fontSize: 13, lineHeight: 17, color: colors.ink, fontVariant: ["tabular-nums"]},
	breathHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 6},
	breathLabel: {flexDirection: "row", alignItems: "center", gap: 5},
	breathTitle: {fontFamily: Theme.fonts.semiBold, fontSize: 12, color: colors.ink},
	breathValue: {fontFamily: Theme.fonts.bold, fontSize: 12, color: colors.blue, fontVariant: ["tabular-nums"]},
	notches: {flexDirection: "row", gap: BREATH_NOTCH_GAP, height: 8},
	notch: {flex: 1, borderRadius: 2, backgroundColor: colors.line},
	regen: {fontFamily: Theme.fonts.medium, fontSize: 11, lineHeight: 15, color: colors.muted, marginTop: 4},
	compactCard: {padding: 8, gap: 6}
}));

function FighterIdentity({fighter}: {fighter: FightFighter}): ReactNode {
	const styles = useStyles();
	return <View style={styles.identity}>
		<Text style={styles.name} numberOfLines={1}>{fighterDisplayName(fighter)}</Text>
		<Text style={styles.classLabel} numberOfLines={1}>{fighterSubtitle(fighter)}</Text>
	</View>;
}

/** The breath left against its maximum, one notch per point, and what the next turn gives back. */
function BreathMeter({fighter}: {fighter: FightFighter}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const {breath, maxBreath, breathRegen} = fighter.stats;
	const value = i18n.t("app:profile.formats.progress", {value: breath, max: maxBreath});
	return <View accessibilityRole="progressbar" accessibilityLabel={i18n.t("app:arena.breath")} accessibilityValue={{now: breath, max: maxBreath}} testID={`fight-stat-breath-${fighter.isSelf ? "self" : "opponent"}`}>
		<View style={styles.breathHead}>
			<View style={styles.breathLabel}><TwemojiIcon emoji={AppIcons.getIcon("unitValues.breath")} size={15} /><Text style={styles.breathTitle}>{i18n.t("app:arena.breath")}</Text></View>
			<Text style={styles.breathValue}>{value}</Text>
		</View>
		<View style={styles.notches}>{Array.from({length: Math.max(maxBreath, 1)}, (_, notch) => <View key={notch} style={[styles.notch, notch < breath && {backgroundColor: colors.blue}]} />)}</View>
		<Text style={styles.regen} numberOfLines={1}>{i18n.t("app:battle.breathRegen", {count: breathRegen})}</Text>
	</View>;
}

function FighterCombatStats({fighter}: {fighter: FightFighter}): ReactNode {
	const styles = useStyles();
	const side = fighter.isSelf ? "self" : "opponent";
	return <View style={styles.liveStats}>{COMBAT_STATS.map(({key}) => <View
		key={key}
		style={styles.liveStat}
		accessible
		accessibilityLabel={`${i18n.t(`app:arena.stats.${key}`)} ${formatNumber(fighter.stats[key])}`}
		testID={`fight-stat-${key}-${side}`}
	>
		<TwemojiIcon emoji={AppIcons.getIcon(`unitValues.${key}`)} size={13} />
		<Text style={styles.liveValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{formatNumber(fighter.stats[key])}</Text>
	</View>)}</View>;
}

function FighterStats({fighter, pet, onClose}: {fighter: FightFighter; pet?: OwnedPet; onClose: () => void}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	return <QuestionSheet
		caption={i18n.t("app:arena.details")}
		title={fighterDisplayName(fighter)}
		onClose={onClose}
	>
		<View style={styles.statRow}>{COMBAT_STATS.map(({key, Icon}) => <View key={key} style={styles.stat}><Icon size={22} color={colors.muted} /><Text style={styles.statValue}>{formatNumber(fighter.stats[key])}</Text><Text style={styles.statLabel}>{i18n.t(`app:arena.stats.${key}`)}</Text></View>)}</View>
		<ExpandableList>
			<Fact label={i18n.t("app:arena.breath")} value={i18n.t("app:profile.formats.progress", {value: fighter.stats.breath, max: fighter.stats.maxBreath})} />
			<Fact label={i18n.t("app:arena.stats.breathRegen")} value={formatNumber(fighter.stats.breathRegen)} />
			{fighter.alteration ? <Fact label={i18n.t("app:arena.effects.newAlteration")} value={fightActionName(fighter.alteration)} /> : null}
			{fighter.glory === undefined ? null : <Fact label={i18n.t("app:arena.glory")} value={formatNumber(fighter.glory)} />}
			{pet ? <Fact label={i18n.t("app:arena.pet")} value={petName(pet)} /> : null}
		</ExpandableList>
	</QuestionSheet>;
}

function FighterRole({fighter}: {fighter: FightFighter}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const alterationIcon = fighter.alteration ? AppIcons.getIconOrNull(`fightActions.${fighter.alteration}`) : null;
	return <View style={styles.roleRow}>
		<View style={[styles.sideMark, {backgroundColor: fighter.isSelf ? colors.blue : colors.red}]} />
		<Text style={styles.role} numberOfLines={1}>{i18n.t(fighter.isSelf ? "app:arena.you" : "app:arena.opponent")}</Text>
		{alterationIcon ? <View accessible accessibilityLabel={fightActionName(fighter.alteration!)}><TwemojiIcon emoji={alterationIcon} size={15} /></View> : null}
		<Info size={14} color={colors.faint} />
	</View>;
}

export function FightFighterCard({fighter, pet, animation}: {fighter: FightFighter; pet?: OwnedPet; animation: FightAnimation}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const [expanded, setExpanded] = useState(false);
	const compact = useCompactFight();
	return <View style={styles.participant} testID={`fight-fighter-${fighter.isSelf ? "self" : "opponent"}`}>
		<Pressable accessibilityRole="button" accessibilityLabel={`${i18n.t("app:arena.details")} : ${fighterDisplayName(fighter)}`} onPress={(): void => setExpanded(true)} style={[styles.card, compact && styles.compactCard]}>
			<FighterRole fighter={fighter} />
			<FightPortrait fighter={fighter} pet={pet} animation={animation} />
			<FighterIdentity fighter={fighter} />
			<FightGauge emoji={AppIcons.getIcon("unitValues.energy")} label={i18n.t("app:arena.energy")} value={fighter.stats.power} max={fighter.stats.maxEnergy} color={fighter.isSelf ? colors.green : colors.red} reducedMotion={animation.reducedMotion} />
			<BreathMeter fighter={fighter} />
			<FighterCombatStats fighter={fighter} />
		</Pressable>
		{expanded ? <FighterStats fighter={fighter} pet={pet} onClose={(): void => setExpanded(false)} /> : null}
	</View>;
}