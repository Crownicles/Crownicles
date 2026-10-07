import {createContext, ReactNode, useContext, useState} from "react";
import {Pressable, Text, View, useWindowDimensions} from "react-native";
import {LucideIcon} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import type {FightSnapshot} from "@/src/store/FightStore";
import type {FightPlayback} from "@/src/store/useFightPlayback";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";

const useStyles = createStyles(colors => ({
	root: {position: "relative"},
	button: {width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12},
	pressed: {backgroundColor: colors.wash},
	tooltip: {position: "absolute", right: 0, top: 44, minWidth: 112, maxWidth: 210, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 6, backgroundColor: colors.ink, zIndex: 20},
	label: {fontFamily: Theme.fonts.medium, fontSize: 11, lineHeight: 15, color: colors.paper},
	header: {flexShrink: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 4, paddingBottom: 8},
	headerBody: {flex: 1, minWidth: 0},
	eyebrow: {fontFamily: Theme.fonts.semiBold, fontSize: 10, color: colors.muted, letterSpacing: 0, textTransform: "uppercase", marginBottom: 5},
	title: {fontFamily: Theme.fonts.extraBold, fontSize: 22, lineHeight: 28, color: colors.ink},
	turn: {fontFamily: Theme.fonts.semiBold, fontSize: 11, color: colors.muted, textAlign: "right", fontVariant: ["tabular-nums"]},
	compactHeader: {paddingTop: 0, paddingBottom: 6}
}));

/**
 * Vertical budget of the battle screen, which never scrolls: header, both fighter cards, the feed
 * and up to three rows of actions. Below this the dense layout is required for the actions to stay
 * fully visible, whatever the device and its safe areas.
 */
const ROOMY_BATTLE_HEIGHT = 820;
const BattleHeightContext = createContext<number | null>(null);

export function BattleHeightProvider({height, children}: {height: number | null; children: ReactNode}): ReactNode {
	return <BattleHeightContext.Provider value={height}>{children}</BattleHeightContext.Provider>;
}

export function useCompactFight(): boolean {
	const measured = useContext(BattleHeightContext);
	const window = useWindowDimensions().height;
	return (measured ?? window) < ROOMY_BATTLE_HEIGHT;
}

export function FightIconButton({icon: Icon, label, onPress, disabled = false}: {icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const [hovered, setHovered] = useState(false);
	return <View style={styles.root}>
		<Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={(): void => {setHovered(false); onPress();}} onHoverIn={(): void => setHovered(true)} onHoverOut={(): void => setHovered(false)} style={({pressed}) => [styles.button, pressed && styles.pressed]}><Icon size={19} color={disabled ? colors.faint : colors.muted} /></Pressable>
		{hovered ? <View pointerEvents="none" style={styles.tooltip}><Text style={styles.label}>{label}</Text></View> : null}
	</View>;
}

export const FIGHT_PHASES = {FINISHED: "finished", ERROR: "unavailable", PLAYING: "resolving", SELF: "yourTurn", OPPONENT: "opponentTurn"} as const;
export type FightPhase = typeof FIGHT_PHASES[keyof typeof FIGHT_PHASES];
export type FightNavigation = {onClose: () => void; onJournal: () => void};

export function FightHeader({fight, playback, phase}: {fight: FightSnapshot; playback: FightPlayback; phase: FightPhase}): ReactNode {
	const styles = useStyles();
	const compact = useCompactFight();
	const status = playback.status;
	return <View style={[styles.header, compact && styles.compactHeader]}>
		<View style={styles.headerBody}><Text style={styles.eyebrow}>{i18n.t(fight.introduction?.opponent.monsterId ? "app:battle.encounter" : "app:battle.duel")}</Text><Text style={styles.title}>{i18n.t(`app:battle.${phase}`)}</Text></View>
		<Text style={styles.turn}>{status ? i18n.t("app:arena.turn", {turn: status.numberOfTurn, max: status.maxNumberOfTurn}) : ""}</Text>
	</View>;
}