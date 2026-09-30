import {ReactNode, useEffect, useRef, useState} from "react";
import {Animated, Easing, ScrollView, Text, View} from "react-native";
import {FightLogRecord} from "@/src/store/FightStore";
import {Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {FightEventIcon} from "@/src/components/FightDetails";
import {FightEffectChips, FightNarrative} from "@/src/components/FightNarrative";
import {fightConsequences, fighterName, fightEntryTitle, fightStory} from "@/src/display/Fight";
import {FIGHT_OUTCOMES, fightCue} from "@/src/display/FightMotion";
import {i18n} from "@/src/translations/i18n";

/** Earlier actions step back so the one just played is read first. */
const PAST_OPACITY = 0.55;
const ENTRANCE = {durationMs: 320, rise: 10} as const;
const THINKING = {dots: 3, stepMs: 400} as const;

const useStyles = createStyles(colors => ({
	feed: {flex: 1, minHeight: 0, marginVertical: Theme.spacing.sm},
	content: {flexGrow: 1, justifyContent: "flex-end", gap: 6, paddingVertical: 4},
	entry: {gap: 6},
	turn: {alignSelf: "center", marginTop: 6, fontFamily: Theme.fonts.bold, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: colors.faint},
	bubble: {maxWidth: "80%", gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Theme.radius, backgroundColor: colors.paper},
	self: {alignSelf: "flex-start", borderLeftWidth: 3, borderLeftColor: colors.blue},
	opponent: {alignSelf: "flex-end", borderRightWidth: 3, borderRightColor: colors.red},
	head: {flexDirection: "row", alignItems: "center", gap: 7},
	title: {flexShrink: 1, fontFamily: Theme.fonts.bold, fontSize: 13, lineHeight: 17, color: colors.ink},
	badge: {fontFamily: Theme.fonts.extraBold, fontSize: 9.5, textTransform: "uppercase", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden"},
	critical: {backgroundColor: colors.goldWash, color: colors.gold},
	missed: {backgroundColor: colors.wash, color: colors.muted},
	story: {fontFamily: Theme.fonts.regular, fontStyle: "italic", fontSize: 12, lineHeight: 17, color: colors.muted},
	thinking: {alignSelf: "flex-end", flexDirection: "row", gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: Theme.radius, backgroundColor: colors.paper, borderRightWidth: 3, borderRightColor: colors.red},
	thinkingDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: colors.faint},
	thinkingDotDim: {opacity: 0.3},
	empty: {alignSelf: "center", fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.caption, color: colors.muted}
}));

/** A critical hit or a miss said in one word, where the story would have taken a sentence. */
function OutcomeBadge({record}: {record: FightLogRecord}): ReactNode {
	const styles = useStyles();
	const cue = fightCue(record.entry);
	if (cue.critical) return <Text style={[styles.badge, styles.critical]}>{i18n.t("app:battle.critical")}</Text>;
	if (!cue.missed) return null;
	return <Text style={[styles.badge, styles.missed]}>{i18n.t(cue.outcome === FIGHT_OUTCOMES.FIZZLED ? "app:battle.noEffect" : "app:battle.missed")}</Text>;
}

/** Slides the action just played into place; the earlier ones are already there. */
function useEntrance(latest: boolean): Animated.Value {
	const still = useReducedMotion();
	const [shown] = useState(() => new Animated.Value(latest && !still ? 0 : 1));
	useEffect(() => {
		// Off the native driver: the fight's own motions are the ones the playback waits for.
		Animated.timing(shown, {toValue: 1, duration: ENTRANCE.durationMs, easing: Easing.out(Easing.cubic), useNativeDriver: false}).start();
	}, [shown]);
	return shown;
}

/** One action, on the side of the fighter who played it, as the cards above are laid out. */
function FeedBubble({record, latest}: {record: FightLogRecord; latest: boolean}): ReactNode {
	const styles = useStyles();
	const shown = useEntrance(latest);
	const {entry} = record;
	const story = fightStory(entry);
	const consequences = fightConsequences(entry);
	const label = [fighterName(entry.fighter), fightEntryTitle(entry), ...consequences.map(consequence => consequence.text)].join(", ");
	return <Animated.View
		accessible
		accessibilityLabel={label}
		style={[styles.bubble, entry.fighter.isSelf ? styles.self : styles.opponent, {
			opacity: latest ? shown : PAST_OPACITY,
			transform: [{translateY: shown.interpolate({inputRange: [0, 1], outputRange: [ENTRANCE.rise, 0]})}]
		}]}
		testID={`fight-feed-${entry.fighter.isSelf ? "self" : "opponent"}`}
	>
		<View style={styles.head}><FightEventIcon entry={entry} size={18} /><Text style={styles.title} numberOfLines={2}>{fightEntryTitle(entry)}</Text><OutcomeBadge record={record} /></View>
		{story ? <FightNarrative style={styles.story}>{story}</FightNarrative> : null}
		<FightEffectChips effects={consequences} />
	</Animated.View>;
}

/** Three dots on the opponent's side while it picks its action, the way a messenger shows someone typing. */
function OpponentThinking(): ReactNode {
	const styles = useStyles();
	const still = useReducedMotion();
	const [lit, setLit] = useState(0);
	useEffect(() => {
		if (still) return undefined;
		const step = setInterval(() => setLit(dot => (dot + 1) % THINKING.dots), THINKING.stepMs);
		return (): void => clearInterval(step);
	}, [still]);
	return <View style={styles.thinking} accessible accessibilityLabel={i18n.t("app:arena.waiting")} testID="fight-feed-thinking">
		{Array.from({length: THINKING.dots}, (_, dot) => <View key={dot} style={[styles.thinkingDot, !still && dot !== lit && styles.thinkingDotDim]} />)}
	</View>;
}

function turnOf(record: FightLogRecord): number | undefined {
	return record.before?.numberOfTurn;
}

function FeedEntry({record, previous, latest}: {record: FightLogRecord; previous: FightLogRecord | undefined; latest: number | undefined}): ReactNode {
	const styles = useStyles();
	const turn = turnOf(record);
	const newTurn = turn !== undefined && (!previous || turnOf(previous) !== turn);
	return <View style={styles.entry}>
		{newTurn ? <Text style={styles.turn}>{i18n.t("app:battle.shortTurn", {turn})}</Text> : null}
		<FeedBubble record={record} latest={record.sequence === latest} />
	</View>;
}

/**
 * The fight told as an exchange: each action on its fighter's side, grouped by turn, the latest at the
 * bottom just above the action buttons. Scrolling back reads the whole fight.
 */
export function FightFeed({entries, opponentThinking, ownTurn}: {entries: FightLogRecord[]; opponentThinking: boolean; ownTurn: boolean}): ReactNode {
	const styles = useStyles();
	const still = useReducedMotion();
	const scroll = useRef<ScrollView>(null);
	const latest = entries.at(-1)?.sequence;
	return <ScrollView
		ref={scroll}
		style={styles.feed}
		contentContainerStyle={styles.content}
		showsVerticalScrollIndicator={false}
		onContentSizeChange={(): void => scroll.current?.scrollToEnd({animated: !still})}
		accessibilityLiveRegion="polite"
		testID="fight-feed"
	>
		{entries.length === 0 && !opponentThinking ? <Text style={styles.empty}>{i18n.t(ownTurn ? "app:battle.ready" : "app:battle.opening")}</Text> : null}
		{entries.map((record, index) => <FeedEntry key={record.sequence} record={record} previous={entries[index - 1]} latest={latest} />)}
		{opponentThinking ? <OpponentThinking /> : null}
	</ScrollView>;
}
