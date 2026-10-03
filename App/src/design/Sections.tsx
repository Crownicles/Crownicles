import {ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
	Animated, ActivityIndicator, Easing, GestureResponderEvent, KeyboardAvoidingView, ModalProps, PanResponder, PanResponderGestureState, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextStyle, useWindowDimensions, View, ViewStyle
} from "react-native";
import {NativeWindow} from "@/src/design/NativeWindow";
import {notificationAsync, NotificationFeedbackType} from "expo-haptics";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {UnitIcon} from "@/src/components/UnitIcon";
import {ArrowRight, ChevronDown, ChevronRight, CircleAlert, LucideIcon} from "@/src/design/FightIcons";
import {CountBadge, PendingMotion, Screen, usePressMotion} from "@/src/design/Primitives";
import {SwipeBack, useSuspendSwipeBack} from "@/src/design/SwipeBack";
import {Theme} from "@/src/design/Theme";
import {splitLeadingEmoji, TwemojiText} from "@/src/design/TwemojiText";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";
import {createStyles, useColors} from "@/src/design/ThemeContext";

/**
 * The grammar every detail screen is written in: an identity banner, a row of figures, a dark
 * call to action that says beforehand why it cannot be pressed, and expandable lists.
 */

const useStyles = createStyles(colors => ({
	surface: {flex: 1, backgroundColor: colors.paper},
	standing: {paddingBottom: Theme.spacing.xl, gap: Theme.spacing.lg},
	identity: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.lg},
	emblem: {width: 64, height: 64, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.wash, borderRadius: 8},
	body: {flex: 1, minWidth: 0, gap: 3},
	caption: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted},
	title: {fontFamily: Theme.fonts.extraBold, fontSize: 23, lineHeight: 29, color: colors.ink},
	chevron: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.chevron, color: colors.faint},
	figures: {flexDirection: "row", paddingVertical: Theme.spacing.lg, paddingHorizontal: Theme.spacing.md},
	figure: {flex: 1, minWidth: 0, gap: 6},
	figureSingle: {alignItems: "center", justifyContent: "space-between"},
	figureEnd: {alignItems: "flex-end"},
	figureValue: {flexDirection: "row", alignItems: "center", gap: 4},
	figureAmount: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, color: colors.ink, fontVariant: ["tabular-nums"]},
	banner: {minHeight: 52, paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md, borderRadius: Theme.pillRadius, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", gap: Theme.spacing.md},
	bannerIcon: {width: 24, height: 24, alignItems: "center", justifyContent: "center"},
	bannerLabelBox: {flex: 1},
	bannerLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.button, lineHeight: Theme.lineHeight.body, color: colors.paper},
	lock: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm, paddingTop: Theme.spacing.md},
	lockText: {flex: 1, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted},
	lockRefusal: {color: colors.red},
	disabled: {opacity: 0.5},
	pressed: {opacity: 0.7},
	/** Rows sit together on one card: the card and the spacing group them, no rule is drawn between them. */
	list: {backgroundColor: colors.paper, borderRadius: Theme.radius, overflow: "hidden"},
	choice: {paddingTop: Theme.spacing.md, paddingBottom: Theme.spacing.xs, paddingHorizontal: Theme.spacing.md, borderLeftWidth: 3, borderLeftColor: "transparent"},
	entryHeader: {minHeight: 72, flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, borderLeftWidth: 3, borderLeftColor: "transparent"},
	expanded: {backgroundColor: colors.wash},
	compact: {minHeight: Theme.dimensions.compactRowMinHeight},
	highlighted: {borderLeftColor: colors.green},
	dimmed: {opacity: 0.45},
	entryEmblem: {width: 32, height: 32, flexShrink: 0, alignItems: "center", justifyContent: "center"},
	entryLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: colors.ink},
	choiceAction: {minHeight: Theme.dimensions.compactRowMinHeight, flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: Theme.radius, backgroundColor: colors.wash},
	choiceActionLabel: {flex: 1, minWidth: 0},
	dangerLabel: {color: colors.red},
	detailBackdrop: {flex: 1, justifyContent: "flex-end"},
	detailVeil: {...StyleSheet.absoluteFill, backgroundColor: colors.overlay},
	detailCard: {backgroundColor: colors.paper, borderTopLeftRadius: Theme.radius * 2, borderTopRightRadius: Theme.radius * 2, paddingHorizontal: Theme.spacing.xl, paddingTop: Theme.spacing.md, gap: Theme.spacing.lg, maxHeight: "85%"},
	detailGrabber: {alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line},
	detailHead: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.md},
	detailBody: {gap: Theme.spacing.md, paddingHorizontal: Theme.spacing.xl},
	sheetHandle: {gap: Theme.spacing.lg, minHeight: Theme.dimensions.compactRowMinHeight},
	// Spans the card's margins so the scroll indicator runs in them, not over right-aligned values.
	sheetScroll: {flexGrow: 0, marginHorizontal: -Theme.spacing.xl},
	back: {alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: Theme.spacing.xs, height: 34, paddingLeft: Theme.spacing.sm, paddingRight: Theme.spacing.md, borderRadius: Theme.pillRadius, backgroundColor: colors.wash, marginBottom: Theme.spacing.lg},
	backLabel: {color: colors.ink, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.body},
	/** The icon set only ships a downward chevron; a quarter turn points it back. */
	backChevron: {transform: [{rotate: "90deg"}]},
	fact: {minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md},
	// TwemojiText applies textStyle to its inner Text: a flex there would stretch the line to the full row.
	factLabelBox: {flex: 1, minWidth: 0},
	factLabel: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted},
	factValue: {flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4},
	factAmount: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: colors.ink, fontVariant: ["tabular-nums"], textAlign: "right"},
	gauge: {paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, gap: 6},
	gaugeTop: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.md},
	gaugeValue: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.ink, fontVariant: ["tabular-nums"]},
	gaugeTrack: {height: 5, borderRadius: 999, backgroundColor: colors.line, overflow: "hidden"},
	gaugeFill: {height: "100%", borderRadius: 999},
	toastLayer: {...StyleSheet.absoluteFill, paddingHorizontal: Theme.spacing.lg},
	toast: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.md,
		paddingVertical: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.lg,
		borderRadius: Theme.radius,
		backgroundColor: colors.ink,
		shadowColor: colors.shadow,
		shadowOpacity: 0.25,
		shadowRadius: 14,
		shadowOffset: {width: 0, height: 6},
		elevation: 8
	},
	toastEmblem: {width: 40, height: 40, flexShrink: 0, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper},
	toastTitle: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: colors.paper},
	toastSubtitle: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.faint},
	toastAmount: {fontFamily: Theme.fonts.extraBold, fontSize: Theme.fontSize.title, color: colors.paper, fontVariant: ["tabular-nums"]},
	effects: {flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.sm},
	effect: {maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingLeft: Theme.spacing.sm, paddingRight: Theme.spacing.md, borderRadius: Theme.pillRadius},
	effectLabel: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: colors.muted},
	effectValue: {flexShrink: 1, fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, fontVariant: ["tabular-nums"]},
	effectGain: {color: colors.green},
	effectLoss: {color: colors.red},
	effectNeutral: {color: colors.ink},
	effectGainChip: {backgroundColor: colors.greenWash},
	effectLossChip: {backgroundColor: colors.redWash},
	effectNeutralChip: {backgroundColor: colors.wash},
	journal: {
		marginBottom: Theme.spacing.xl,
		padding: Theme.spacing.xl,
		gap: Theme.spacing.lg,
		borderRadius: Theme.radius,
		backgroundColor: colors.paper,
		shadowColor: colors.shadow,
		shadowOpacity: 0.06,
		shadowRadius: 12,
		shadowOffset: {width: 0, height: 4},
		elevation: 2
	},
	journalEmblem: {width: 44, height: 44, flexShrink: 0, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.wash},
	/** The same entry inside a bottom sheet, which is already the white page. */
	journalPlain: {gap: Theme.spacing.lg},
	journalTitle: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: colors.ink},
	card: {
		marginBottom: Theme.spacing.xl,
		borderRadius: Theme.radius,
		backgroundColor: colors.paper,
		shadowColor: colors.shadow,
		shadowOpacity: 0.06,
		shadowRadius: 12,
		shadowOffset: {width: 0, height: 4},
		elevation: 2
	},
	// The shadow lives on the outer view: clipping it there would erase it.
	cardClip: {borderRadius: Theme.radius, overflow: "hidden"},
	you: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: colors.green},
	lineGauge: {paddingTop: Theme.spacing.lg}
}));

type SectionStyles = ReturnType<typeof useStyles>;

/** Why an action cannot be taken, so the screen can say it instead of letting the player find out. */
export type Lock = {reason: string; icon?: LucideIcon};

export function ChoiceAction({label, disabled = false, onPress}: {
	label: string;
	disabled?: boolean;
	onPress: () => void;
}): ReactNode {
	const styles = useStyles();
	const {emoji: leadingEmoji, text} = splitLeadingEmoji(label);
	return <Pressable
		accessibilityRole="button"
		accessibilityLabel={label}
		disabled={disabled}
		onPress={onPress}
		style={({pressed}): object[] => [styles.choiceAction, disabled && styles.disabled, pressed && styles.pressed].filter(Boolean) as object[]}
	>
		{leadingEmoji ? <TwemojiIcon emoji={leadingEmoji} size={Theme.fontSize.rowTitle} /> : null}
		<TwemojiText containerStyle={styles.choiceActionLabel} textStyle={styles.entryLabel} emojiSize={Theme.fontSize.rowTitle}>{text}</TwemojiText>
		<ArrowRight size={20} />
	</Pressable>;
}

/** A hint only explains what is closed; a refusal says what the player did is wrong, in red. */
export const HINT_TONES = {HINT: "hint", REFUSAL: "refusal"} as const;
export type HintTone = typeof HINT_TONES[keyof typeof HINT_TONES];

/** Whether a consequence helps the player, hurts them, or only tells them something. */
export const EFFECT_TONES = {GAIN: "gain", LOSS: "loss", NEUTRAL: "neutral"} as const;
export type EffectTone = typeof EFFECT_TONES[keyof typeof EFFECT_TONES];

/** One consequence on the player, drawn with the game emoji of what changed: a unit, or any emoji of the game. */
export type Effect = {label: string; value: string; tone: EffectTone; unit?: string; emoji?: string};

const EFFECT_EMBLEM_SIZE = 15;
const EFFECT_TONE_STYLES = {
	[EFFECT_TONES.GAIN]: {value: "effectGain", chip: "effectGainChip"},
	[EFFECT_TONES.LOSS]: {value: "effectLoss", chip: "effectLossChip"},
	[EFFECT_TONES.NEUTRAL]: {value: "effectNeutral", chip: "effectNeutralChip"}
} as const;

function EffectEmblem({effect}: {effect: Effect}): ReactNode {
	if (effect.unit) return <UnitIcon unit={effect.unit} size={EFFECT_EMBLEM_SIZE} />;
	return effect.emoji ? <TwemojiIcon emoji={effect.emoji} size={EFFECT_EMBLEM_SIZE} /> : null;
}

/** Chips pop in one after the other, so a list of gains is read one gain at a time. */
const EFFECT_MOTION = {staggerMs: 90, popMs: 320, fromScale: 0.6, overshoot: 1.8} as const;

function EffectChip({effect, order, still}: {effect: Effect; order: number; still: boolean}): ReactNode {
	const styles = useStyles();
	const [pop] = useState(() => new Animated.Value(still ? 1 : 0));
	useEffect(() => {
		if (still) return;
		Animated.timing(pop, {toValue: 1, duration: EFFECT_MOTION.popMs, delay: order * EFFECT_MOTION.staggerMs, easing: Easing.out(Easing.back(EFFECT_MOTION.overshoot)), useNativeDriver: true}).start();
	}, [pop, order, still]);
	return <Animated.View
		style={[styles.effect, styles[EFFECT_TONE_STYLES[effect.tone].chip], {opacity: pop, transform: [{scale: pop.interpolate({inputRange: [0, 1], outputRange: [EFFECT_MOTION.fromScale, 1]})}]}]}
		testID="event-effect"
	>
		<EffectEmblem effect={effect} />
		<Text style={styles.effectLabel}>{effect.label}</Text>
		<Text style={[styles.effectValue, styles[EFFECT_TONE_STYLES[effect.tone].value]]}>{effect.value}</Text>
	</Animated.View>;
}

/** What an event did to the player, one tinted chip per change: green when it helps, red when it hurts. */
export function Effects({items}: {items: Effect[]}): ReactNode {
	const styles = useStyles();
	const still = useReducedMotion();
	return <View style={styles.effects}>{items.map((effect, order) => <EffectChip key={effect.label} effect={effect} order={order} still={still} />)}</View>;
}

/**
 * An entry of the adventure journal, laid out in the order Discord posts it: whose journal it is
 * with the event's emoji, what the event changed, then the game's own prose.
 */
export function JournalEntry({emblem, title, effects, plain = false, children}: {
	emblem?: ReactNode;
	title: string;
	effects: Effect[];

	/** Inside a bottom sheet, which is already the white page the card would draw. */
	plain?: boolean;
	children: ReactNode;
}): ReactNode {
	const styles = useStyles();
	return <View style={plain ? styles.journalPlain : styles.journal}>
		<View style={styles.identity}>
			{emblem ? <View style={styles.journalEmblem}>{emblem}</View> : null}
			<Text style={styles.journalTitle}>{title}</Text>
		</View>
		{effects.length > 0 ? <Effects items={effects} /> : null}
		{children}
	</View>;
}

/** A list lifted on the same white page as a journal entry, so the rows that follow it read as one piece. */
export function Card({children}: {children: ReactNode}): ReactNode {
	const styles = useStyles();
	return <View style={styles.card}><View style={styles.cardClip}>{children}</View></View>;
}

const TOAST_DURATION_MS = 4_000;
const TOAST_ENTRANCE_MS = 220;
const TOAST_ENTRANCE_OFFSET = -24;
const TOAST_UNIT_SIZE = 18;
const TOAST_EMBLEM_POP = {from: 0.4, friction: 4, tension: 140} as const;
const STANDING_TITLE_EMOJI_SIZE = 22;
const BANNER_EMOJI_SIZE = 22;
const BANNER_LABEL_LINES = 2;

/** The gain a toast announces, as a number and the game emoji of its unit. */
export type ToastValue = {amount: string; unit: string};

function ToastContent({emblem, emblemPop, title, subtitle, value}: {emblem?: ReactNode; emblemPop: Animated.Value; title: string; subtitle?: string; value?: ToastValue}): ReactNode {
	const styles = useStyles();
	return <>
		{emblem ? <Animated.View style={[styles.toastEmblem, {transform: [{scale: emblemPop}]}]}>{emblem}</Animated.View> : null}
		<View style={styles.body}>
			<Text style={styles.toastTitle} numberOfLines={1}>{title}</Text>
			{subtitle ? <Text style={styles.toastSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
		</View>
		{value ? <View style={styles.figureValue}>
			<Text style={styles.toastAmount} numberOfLines={1}>{value.amount}</Text>
			<UnitIcon unit={value.unit} size={TOAST_UNIT_SIZE} />
		</View> : null}
	</>;
}

/**
 * A short acknowledgement floating over the screen, which leaves by itself; a tap sends it away sooner,
 * or where `onPress` leads. `onDismiss` must keep its identity across renders, or the countdown restarts.
 */
export function Toast({emblem, title, subtitle, value, onDismiss, onPress}: {
	emblem?: ReactNode;
	title: string;
	subtitle?: string;
	value?: ToastValue;
	onDismiss: () => void;
	onPress?: () => void;
}): ReactNode {
	const styles = useStyles();
	const insets = useSafeAreaInsets();
	const [entrance] = useState(() => new Animated.Value(0));
	// The emblem lands once the toast is down, with a bounce: a level gained, a mission done.
	const [emblemPop] = useState(() => new Animated.Value(TOAST_EMBLEM_POP.from));
	useEffect(() => {
		Animated.sequence([
			Animated.timing(entrance, {toValue: 1, duration: TOAST_ENTRANCE_MS, useNativeDriver: true}),
			Animated.spring(emblemPop, {toValue: 1, friction: TOAST_EMBLEM_POP.friction, tension: TOAST_EMBLEM_POP.tension, useNativeDriver: true})
		]).start();
		const timer = setTimeout(onDismiss, TOAST_DURATION_MS);
		return (): void => clearTimeout(timer);
	}, [entrance, emblemPop, onDismiss]);
	return <View pointerEvents="box-none" style={[styles.toastLayer, {paddingTop: insets.top + Theme.spacing.sm}]}>
		<Animated.View style={{opacity: entrance, transform: [{translateY: entrance.interpolate({inputRange: [0, 1], outputRange: [TOAST_ENTRANCE_OFFSET, 0]})}]}}>
			<Pressable
				accessibilityRole="alert"
				accessibilityLiveRegion="polite"
				onPress={onPress ?? onDismiss}
				style={styles.toast}
			>
				<ToastContent emblem={emblem} emblemPop={emblemPop} title={title} {...subtitle ? {subtitle} : {}} {...value ? {value} : {}} />
			</Pressable>
		</Animated.View>
	</View>;
}

/** React Native paints a full-screen modal white until its content lays out: the palette avoids a flash in dark mode. */
export function SheetModal(props: Omit<ModalProps, "animationType" | "backdropColor">): ReactNode {
	const colors = useColors();
	return <NativeWindow animationType="slide" backdropColor={colors.paper} {...props} />;
}

/** A full-screen modal is its own window on iOS, where `SafeAreaView` measures nothing: apply the insets here. */
export function ModalSurface({children, tone = "paper"}: {children: ReactNode; tone?: "paper" | "wash"}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const insets = useSafeAreaInsets();
	return <View style={[styles.surface, {backgroundColor: colors[tone], paddingTop: insets.top, paddingBottom: insets.bottom}]}>{children}</View>;
}

export function LockHint({lock, tone = HINT_TONES.HINT, testID}: {lock: Lock; tone?: HintTone; testID?: string}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const Icon = lock.icon ?? CircleAlert;
	const refusal = tone === HINT_TONES.REFUSAL;
	return <View style={styles.lock} testID={testID}>
		<Icon size={15} color={refusal ? colors.red : colors.muted} />
		<Text style={[styles.lockText, refusal && styles.lockRefusal]}>{lock.reason}</Text>
	</View>;
}

/** What the server answered instead of doing what was asked, shown where the player asked it. */
export function Refusal({children}: {children: string}): ReactNode {
	return <LockHint lock={{reason: children}} tone={HINT_TONES.REFUSAL} />;
}

export function BackButton({label, onClose}: {label: string; onClose: () => void}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onClose} style={({pressed}): object[] => [styles.back, pressed && styles.pressed].filter(Boolean) as object[]}>
		<View style={styles.backChevron}><ChevronDown size={18} color={colors.ink} /></View>
		{/* Always « Retour », so it is never confused with a screen's own cancel button. */}
		<Text style={styles.backLabel}>{i18n.t("app:common.back")}</Text>
	</Pressable>;
}

export function Standing({emblem, caption, title, subtitle, children, onPress, accessibilityLabel, testID}: {
	emblem?: ReactNode;
	caption: string;
	title: string;
	subtitle?: string;
	children?: ReactNode;
	onPress?: () => void;
	accessibilityLabel?: string;
	testID?: string;
}): ReactNode {
	const styles = useStyles();
	const identity = <>
		{emblem ? <View style={styles.emblem}>{emblem}</View> : null}
		<View style={styles.body}>
			<Text style={styles.caption}>{caption}</Text>
			<TwemojiText textStyle={styles.title} emojiSize={STANDING_TITLE_EMOJI_SIZE}>{title}</TwemojiText>
			{subtitle ? <TwemojiText textStyle={styles.caption} emojiSize={Theme.fontSize.caption} iosEmojiVerticalOffset={Theme.emoji.iosCaptionOffset}>{subtitle}</TwemojiText> : null}
		</View>
	</>;
	return <View style={styles.standing} testID={testID}>
		{onPress
			? <Pressable
				accessibilityRole="button"
				{...accessibilityLabel ? {accessibilityLabel} : {}}
				onPress={onPress}
				style={({pressed}): object[] => [styles.identity, pressed && styles.pressed].filter(Boolean) as object[]}
			>{identity}<Text style={styles.chevron}>›</Text></Pressable>
			: <View style={styles.identity}>{identity}</View>}
		{children}
	</View>;
}

/** Whether a full screen can be left at any time, or holds the player until what it shows is over. */
export const FULL_SCREEN_KINDS = {STANDARD: "standard", BLOCKING: "blocking"} as const;
export type FullScreenKind = typeof FULL_SCREEN_KINDS[keyof typeof FULL_SCREEN_KINDS];

/**
 * The one full-screen window of the app, for what needs all the room: a long list to compare, a form,
 * a fight. A standard one is left like a pushed page; a blocking one ignores the back gesture and the
 * hardware back, so a fight cannot be walked away from.
 */
export function FullScreen({onClose, onShow, kind = FULL_SCREEN_KINDS.STANDARD, tone = "paper", children}: {
	onClose: () => void;
	onShow?: () => void;
	kind?: FullScreenKind;
	tone?: "paper" | "wash";
	children: ReactNode;
}): ReactNode {
	const blocking = kind === FULL_SCREEN_KINDS.BLOCKING;
	return <SheetModal visible onRequestClose={blocking ? (): void => undefined : onClose} {...onShow ? {onShow} : {}}>
		<ModalSurface tone={tone}>
			{blocking ? children : <SwipeBack onClose={onClose}>{children}</SwipeBack>}
		</ModalSurface>
	</SheetModal>;
}

/** A window the server opens over a screen: an answer to read, or a question only Core can settle. */
export function Sheet({caption, title, subtitle, emblem, closeLabel, onClose, onShow, children}: {
	caption: string;
	title: string;
	subtitle?: string;
	emblem?: ReactNode;
	closeLabel: string;
	onClose: () => void;
	onShow?: () => void;
	children: ReactNode;
}): ReactNode {
	return <FullScreen onClose={onClose} {...onShow ? {onShow} : {}}>
		<Screen>
			<BackButton label={closeLabel} onClose={onClose} />
			<Standing caption={caption} title={title} {...subtitle ? {subtitle} : {}} {...emblem ? {emblem} : {}} />
			{children}
		</Screen>
	</FullScreen>;
}

/** Settles quickly with a hint of bounce, like a sheet dropped on a table. */
const SHEET_SPRING = {damping: 22, stiffness: 220, mass: 0.9, useNativeDriver: true} as const;
const SHEET_DISMISS = {distance: 90, velocity: 0.8, slop: 10, verticalRatio: 2, pull: 70} as const;
const SHEET_LEAVE = {returnAfterMs: 1_500} as const;
/** Stiff and clamped: the sheet keeps the finger's momentum and leaves without bouncing at the bottom. */
const SHEET_LEAVE_SPRING = {stiffness: 260, damping: 30, mass: 1, overshootClamping: true, useNativeDriver: true} as const;
const MILLISECONDS_PER_SECOND = 1_000;
const SHEET_SCROLL_THROTTLE_MS = 16;

type SheetDrag = Pick<PanResponderGestureState, "dx" | "dy" | "numberActiveTouches">;

export function sheetDragStarts(gesture: SheetDrag, scrollOffset = 0): boolean {
	return gesture.numberActiveTouches === 1 && scrollOffset <= 0 && gesture.dy > SHEET_DISMISS.slop && gesture.dy > Math.abs(gesture.dx) * SHEET_DISMISS.verticalRatio;
}

class SheetGestureState {
	private scrollOffset = 0;
	private scrollAtTouchStart = 0;
	private interrupted = false;

	public updateScroll(offset: number): void {this.scrollOffset = offset;}
	public beginTouch(): void {this.scrollAtTouchStart = this.scrollOffset;}
	public starts(gesture: SheetDrag): boolean {return sheetDragStarts(gesture, this.scrollAtTouchStart);}
	public beginDrag(): void {this.interrupted = false;}
	public acceptsMove(touches: number): boolean {
		if (touches > 1) this.interrupted = true;
		return !this.interrupted;
	}
	// A drag that ends up sideways is a swipe across the content, never a request to close.
	public closes(gesture: Pick<PanResponderGestureState, "dx" | "dy" | "vy">): boolean {
		return !this.interrupted && gesture.dy > Math.abs(gesture.dx) && (gesture.dy > SHEET_DISMISS.distance || gesture.vy > SHEET_DISMISS.velocity);
	}
}

/**
 * Closing slides the sheet down before its owner removes it. A sheet its owner keeps open (a question
 * that must be answered) comes back up rather than linger off screen, swallowing every touch.
 */
function useSheetLeave(offset: Animated.Value, height: number, onClose: () => void): (velocity?: number) => void {
	const reducedMotion = useReducedMotion();
	const leaving = useRef(false);
	const close = useRef(onClose);
	const comeBack = useRef<ReturnType<typeof setTimeout> | null>(null);
	const mounted = useRef(true);
	useEffect(() => {
		close.current = onClose;
	}, [onClose]);
	useEffect(() => {
		mounted.current = true;
		return (): void => {
			mounted.current = false;
			if (comeBack.current) clearTimeout(comeBack.current);
		};
	}, []);
	return useCallback((velocity = 0): void => {
		if (leaving.current) return;
		leaving.current = true;
		const closed = (): void => {
			if (!mounted.current) return;
			close.current();
			comeBack.current = setTimeout(() => {
				leaving.current = false;
				Animated.spring(offset, {toValue: 0, ...SHEET_SPRING}).start();
			}, SHEET_LEAVE.returnAfterMs);
		};
		if (reducedMotion) {
			closed();
			return;
		}
		// The gesture measures pixels per millisecond, the spring pixels per second.
		Animated.spring(offset, {toValue: height, velocity: velocity * MILLISECONDS_PER_SECOND, ...SHEET_LEAVE_SPRING}).start(closed);
	}, [height, offset, reducedMotion]);
}

/**
 * Everything that rises from the bottom: the detail of a line, a quick question, a short result.
 * A tap above it or a downward drag of its header or unscrolled content puts it away.
 */
export function BottomSheet({onClose, onShown, onDismissed, visible = true, heading, children, testID}: {
	onClose: () => void;

	/** Once the sheet has settled, for an animation that should not play while it is still rising. */
	onShown?: () => void;

	/** Once iOS has fully put the sheet away, after `visible` turned false. */
	onDismissed?: () => void;
	visible?: boolean;
	heading?: ReactNode;
	children: ReactNode;
	testID?: string;
}): ReactNode {
	const styles = useStyles();
	const insets = useSafeAreaInsets();
	const {height} = useWindowDimensions();
	const [offset] = useState(() => new Animated.Value(height));
	const [gestureState] = useState(() => new SheetGestureState());
	const leave = useSheetLeave(offset, height, onClose);
	useSuspendSwipeBack(visible);
	const shown = useRef(onShown);
	useEffect(() => {
		shown.current = onShown;
	}, [onShown]);
	useEffect(() => {
		Animated.spring(offset, {toValue: 0, ...SHEET_SPRING}).start(({finished}) => {
			if (finished) shown.current?.();
		});
	}, [offset]);
	const dragHandlers = useMemo(() => ({
		onPanResponderGrant: (): void => {
			gestureState.beginDrag();
			offset.stopAnimation();
		},
		onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
			if (!gestureState.acceptsMove(gesture.numberActiveTouches)) {
				Animated.spring(offset, {toValue: 0, ...SHEET_SPRING}).start();
				return;
			}
			offset.setValue(Math.max(0, gesture.dy));
		},
		onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
			if (gestureState.closes(gesture)) {
				leave(gesture.vy);
				return;
			}
			// A sheet that cannot be dismissed yet settles back instead of staying where the finger left it.
			Animated.spring(offset, {toValue: 0, ...SHEET_SPRING}).start();
		},
		onPanResponderTerminate: (): void => {Animated.spring(offset, {toValue: 0, ...SHEET_SPRING}).start();}
	}), [gestureState, offset, leave]);
	const headerDrag = useMemo(() => PanResponder.create({
		onMoveShouldSetPanResponderCapture: (_event, gesture): boolean => sheetDragStarts(gesture),
		...dragHandlers
	}), [dragHandlers]);
	const contentDrag = useMemo(() => PanResponder.create({
		onStartShouldSetPanResponderCapture: (): boolean => {
			gestureState.beginTouch();
			return false;
		},
		onMoveShouldSetPanResponderCapture: (_event, gesture): boolean => gestureState.starts(gesture),
		...dragHandlers
	}), [dragHandlers, gestureState]);
	return <NativeWindow visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={(): void => leave()} {...onDismissed ? {onDismiss: onDismissed} : {}}>
		<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.detailBackdrop}>
			{/* The veil lightens as the sheet goes down, so a drag or a close reads as one movement. */}
			<Animated.View pointerEvents="none" style={[styles.detailVeil, {opacity: offset.interpolate({inputRange: [0, height], outputRange: [1, 0], extrapolate: "clamp"})}]} />
			<Pressable accessibilityRole="button" accessibilityLabel={i18n.t("app:common.back")} style={StyleSheet.absoluteFill} onPress={(): void => leave()} testID="detail-sheet-backdrop" />
			<Animated.View {...contentDrag.panHandlers} style={[styles.detailCard, {paddingBottom: insets.bottom + Theme.spacing.xl, transform: [{translateY: offset}]}]} testID={testID}>
				<View {...headerDrag.panHandlers} style={styles.sheetHandle} testID="bottom-sheet-handle">
					<View style={styles.detailGrabber} />
					{heading}
				</View>
				<ScrollView
					style={styles.sheetScroll}
					contentContainerStyle={styles.detailBody}
					keyboardShouldPersistTaps="handled"
					onScroll={event => gestureState.updateScroll(event.nativeEvent.contentOffset.y)}
					// iOS hands the pull to the scroll view: released far enough past the top, the content takes the sheet away.
					alwaysBounceVertical
					onScrollEndDrag={event => {
						if (event.nativeEvent.contentOffset.y < -SHEET_DISMISS.pull) leave();
					}}
					scrollEventThrottle={SHEET_SCROLL_THROTTLE_MS}
				>{children}</ScrollView>
			</Animated.View>
		</KeyboardAvoidingView>
	</NativeWindow>;
}

/** A short question or result in a bottom sheet, headed like a page so the player knows what it is about. */
export function QuestionSheet({caption, title, subtitle, emblem, onClose, onShown, children, testID}: {
	caption: string;
	title: string;
	subtitle?: string;
	emblem?: ReactNode;
	onClose: () => void;
	onShown?: () => void;
	children: ReactNode;
	testID?: string;
}): ReactNode {
	return <BottomSheet
		onClose={onClose}
		{...onShown ? {onShown} : {}}
		{...testID ? {testID} : {}}
		heading={<Standing caption={caption} title={title} {...subtitle ? {subtitle} : {}} {...emblem ? {emblem} : {}} />}
	>{children}</BottomSheet>;
}

/** One headline number, with the game emoji of its unit when it has one. */
export type Figure = {caption: string; value: string; unit?: string};

function FigureValue({figure}: {figure: Figure}): ReactNode {
	const styles = useStyles();
	return <View style={styles.figureValue}>
		<Text style={styles.figureAmount}>{figure.value}</Text>
		{figure.unit ? <UnitIcon unit={figure.unit} size={15} /> : null}
	</View>;
}

/** Side by side when there are several; a lone figure spans the line instead of sitting in a corner. */
export function Figures({items}: {items: Figure[]}): ReactNode {
	const styles = useStyles();
	if (items.length === 1) {
		return <View style={[styles.figures, styles.figureSingle]}>
			<Text style={styles.caption}>{items[0].caption}</Text>
			<FigureValue figure={items[0]} />
		</View>;
	}
	return <View style={styles.figures}>{items.map((figure, index) => <View key={figure.caption} style={[styles.figure, index === items.length - 1 && index > 0 && styles.figureEnd]}>
		<Text style={styles.caption}>{figure.caption}</Text>
		<FigureValue figure={figure} />
	</View>)}</View>;
}

/** A locked button shakes its head when pressed anyway, instead of ignoring the finger. */
const REFUSAL_SHAKE = {distance: 6, stepMs: 45, swings: 3} as const;

function useRefusalShake(): {offset: Animated.Value; shake: () => void} {
	const reducedMotion = useReducedMotion();
	const [offset] = useState(() => new Animated.Value(0));
	const swing = (toValue: number): Animated.CompositeAnimation => Animated.timing(offset, {toValue, duration: REFUSAL_SHAKE.stepMs, useNativeDriver: true});
	return {
		offset,
		shake: (): void => {
			notificationAsync(NotificationFeedbackType.Warning).catch(() => undefined);
			if (reducedMotion) return;
			const swings = Array.from({length: REFUSAL_SHAKE.swings}, () => [swing(REFUSAL_SHAKE.distance), swing(-REFUSAL_SHAKE.distance)]).flat();
			Animated.sequence([...swings, swing(0)]).start();
		}
	};
}

type BannerAvailability = {blocked: boolean; refusable: boolean};

function bannerAvailability(pending: boolean, disabled: boolean, lock: Lock | undefined): BannerAvailability {
	return {
		blocked: pending || disabled || Boolean(lock),
		refusable: Boolean(lock) && !pending && !disabled
	};
}

export function ActionBanner({icon: Icon, emoji, label, onPress, pending = false, disabled = false, lock, hint, badge = 0, testID}: {
	icon: LucideIcon;

	/** A game emoji drawn instead of `icon`, when the action spends or earns something the game draws. */
	emoji?: string;
	label: string;
	onPress: () => void;
	pending?: boolean;

	/** Greyed without a notice, for when the screen already says why. */
	disabled?: boolean;
	lock?: Lock;

	/** What the player should know before pressing, without preventing the press. */
	hint?: Lock;
	badge?: number;
	testID?: string;
}): ReactNode {
	const styles = useStyles();
	const colors = useColors();
	const {blocked, refusable} = bannerAvailability(pending, disabled, lock);
	const {scale, iconScale, handlers} = usePressMotion(onPress);
	const {offset, shake} = useRefusalShake();
	const glyph = emoji ? <TwemojiIcon emoji={emoji} size={BANNER_EMOJI_SIZE} /> : <Icon size={20} color={colors.paper} />;
	const notice = lock ?? hint;
	return <View>
		{/* A locked banner stays disabled for assistive tech; the press it ignores reaches this wrapper, which shakes it. */}
		<Pressable accessible={false} {...refusable ? {onPress: shake} : {}}>
			<Pressable
				accessibilityRole="button"
				{...badge > 0 ? {accessibilityLabel: label, accessibilityHint: i18n.t("app:common.toCollect", {count: badge})} : {}}
				accessibilityState={{disabled: blocked, busy: pending}}
				disabled={blocked}
				{...handlers}
			>
				{({pressed}): ReactNode => <Animated.View style={[styles.banner, blocked && styles.disabled, pressed && styles.pressed, {transform: [{scale}, {translateX: offset}]}]}>
				<View style={styles.bannerIcon}>
					{pending ? <PendingMotion>{glyph}</PendingMotion> : <Animated.View style={{transform: [{scale: iconScale}]}}>{glyph}</Animated.View>}
				</View>
				<TwemojiText containerStyle={styles.bannerLabelBox} textStyle={styles.bannerLabel} emojiSize={Theme.fontSize.button} numberOfLines={BANNER_LABEL_LINES}>{label}</TwemojiText>
				<CountBadge count={badge} />
				<ArrowRight size={18} color={colors.paper} />
			</Animated.View>}
			</Pressable>
		</Pressable>
		{notice ? <LockHint lock={notice} testID={testID} /> : null}
	</View>;
}

export function ExpandableList({children}: {children: ReactNode}): ReactNode {
	const styles = useStyles();
	return <View style={styles.list}>{children}</View>;
}

/** Whether pressing an entry unfolds it, takes the player elsewhere, or does nothing at all. */
export const ENTRY_CHEVRONS = {
	EXPAND: "expand",
	FORWARD: "forward",
	NONE: "none"
} as const;
export type EntryChevron = typeof ENTRY_CHEVRONS[keyof typeof ENTRY_CHEVRONS];

function EntryChevronIcon({chevron}: {chevron: EntryChevron}): ReactNode {
	const colors = useColors();
	if (chevron === ENTRY_CHEVRONS.NONE) return null;
	return <ChevronRight size={16} color={chevron === ENTRY_CHEVRONS.FORWARD ? colors.faint : colors.muted} />;
}

type EntryHeadingProps = {emblem?: ReactNode; label: string; caption?: ReactNode; danger?: boolean};

/** The emblem, name and caption a line shows, repeated on top of its details so the player knows what they are reading. */
function EntryHeading({emblem, label, caption, danger = false}: EntryHeadingProps): ReactNode {
	const styles = useStyles();
	return <>
		{emblem ? <View style={styles.entryEmblem}>{emblem}</View> : null}
		<View style={styles.body}>
			<TwemojiText textStyle={danger ? [styles.entryLabel, styles.dangerLabel] : styles.entryLabel} emojiSize={Theme.fontSize.rowTitle}>{label}</TwemojiText>
			{typeof caption === "string" ? <TwemojiText textStyle={styles.caption} emojiSize={Theme.fontSize.caption} iosEmojiVerticalOffset={Theme.emoji.iosCaptionOffset}>{caption}</TwemojiText> : caption}
		</View>
	</>;
}

/** The details of a line rise over the screen rather than push the rest of the list down. */
function DetailSheet({heading, onClose, children, testID, dismissal}: {heading: ReactNode; onClose: () => void; children: ReactNode; testID: string | undefined; dismissal: SheetDismissal}): ReactNode {
	const styles = useStyles();
	return <BottomSheet
		onClose={onClose}
		visible={dismissal.visible}
		{...dismissal.onDismissed ? {onDismissed: dismissal.onDismissed} : {}}
		heading={<View style={styles.detailHead}>{heading}</View>}
		{...testID ? {testID} : {}}
	>{children}</BottomSheet>;
}

type SheetDismissal = {mounted: boolean; visible: boolean; onDismissed?: () => void};

/**
 * iOS shows one modal at a time: a window opened while a sheet is still leaving gets lost and leaves an
 * invisible layer swallowing every touch. Given `onDismissed`, the sheet stays mounted until iOS has put it away.
 */
function useSheetDismissal(expanded: boolean, onDismissed?: () => void): SheetDismissal {
	const [closing, setClosing] = useState(false);
	const [wasExpanded, setWasExpanded] = useState(expanded);
	// Elsewhere the modal reports no dismissal: closings are counted and answered once committed.
	const [closings, setClosings] = useState(0);
	const dismissed = useRef(onDismissed);
	useEffect(() => {
		dismissed.current = onDismissed;
	}, [onDismissed]);
	if (expanded !== wasExpanded) {
		setWasExpanded(expanded);
		if (!expanded && onDismissed) {
			if (Platform.OS === "ios") setClosing(true);
			else setClosings(count => count + 1);
		}
	}
	useEffect(() => {
		if (closings > 0) dismissed.current?.();
	}, [closings]);
	return {
		mounted: expanded || closing,
		visible: expanded,
		...onDismissed ? {onDismissed: (): void => {
			setClosing(false);
			onDismissed();
		}} : {}
	};
}

type EntryLook = {expanded: boolean; highlighted: boolean; dimmed: boolean; compact: boolean};

function entryHeaderStyle(styles: SectionStyles, {expanded, highlighted, dimmed, compact}: EntryLook, pressed: boolean): object[] {
	return [styles.entryHeader, compact && styles.compact, expanded && styles.expanded, highlighted && styles.highlighted, dimmed && !expanded && styles.dimmed, pressed && styles.pressed].filter(Boolean) as object[];
}

export function ExpandableEntry({emblem, label, caption, danger = false, end, expanded, onToggle, onDismissed, chevron = ENTRY_CHEVRONS.EXPAND, highlighted = false, dimmed = false, children, testID}: EntryHeadingProps & {
	end?: ReactNode;
	expanded: boolean;
	onToggle: () => void;

	/** Once the details are fully put away, for an action that opens another window. */
	onDismissed?: () => void;
	chevron?: EntryChevron;
	highlighted?: boolean;
	dimmed?: boolean;
	children?: ReactNode;
	testID?: string;
}): ReactNode {
	const styles = useStyles();
	const dismissal = useSheetDismissal(expanded, onDismissed);
	const heading = <EntryHeading emblem={emblem} label={label} caption={caption} danger={danger} />;
	return <View>
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{selected: expanded, expanded}}
			onPress={onToggle}
			style={({pressed}): object[] => entryHeaderStyle(styles, {expanded, highlighted, dimmed, compact: !emblem && !caption}, pressed)}
		>
			{heading}
			{end}
			<EntryChevronIcon chevron={chevron} />
		</Pressable>
		{dismissal.mounted && children ? <DetailSheet heading={heading} onClose={onToggle} testID={testID} dismissal={dismissal}>{children}</DetailSheet> : null}
	</View>;
}

/** A plain statement of fact: what it is on the left, what it is worth on the right. */
export function Fact({label, value, unit, end}: {
	label: string;
	value?: string;
	unit?: string;
	end?: ReactNode;
}): ReactNode {
	const styles = useStyles();
	return <View style={styles.fact}>
		<TwemojiText containerStyle={styles.factLabelBox} textStyle={styles.factLabel} emojiSize={Theme.fontSize.caption}>{label}</TwemojiText>
		{end !== undefined && typeof end !== "string"
			? end
			: <View style={styles.factValue}>
				<TwemojiText textStyle={styles.factAmount} emojiSize={Theme.fontSize.rowTitle}>{typeof end === "string" ? end : value ?? ""}</TwemojiText>
				{unit ? <UnitIcon unit={unit} size={15} /> : null}
			</View>}
	</View>;
}

function rowTrailing(styles: SectionStyles, end: ReactNode): ReactNode {
	return typeof end === "string"
		? <TwemojiText textStyle={styles.caption} emojiSize={Theme.fontSize.caption} iosEmojiVerticalOffset={Theme.emoji.iosCaptionOffset}>{end}</TwemojiText>
		: end;
}

/** A row that leads somewhere rather than unfolding, written in the same hand as the entries; `danger` writes it in red, for what cannot be undone. */
export function EntryRow({title, subtitle, end, emblem, onPress, disabled = false, danger = false, testID}: {
	title: string;
	subtitle?: string;
	end?: ReactNode;
	emblem?: ReactNode;
	onPress?: () => void;
	disabled?: boolean;
	danger?: boolean;
	testID?: string;
}): ReactNode {
	const trailing = rowTrailing(useStyles(), end);
	const action = disabled ? undefined : onPress;
	return <ExpandableEntry
		{...emblem ? {emblem} : {}}
		label={title}
		{...subtitle === undefined ? {} : {caption: subtitle}}
		{...trailing === undefined ? {} : {end: trailing}}
		{...testID === undefined ? {} : {testID}}
		dimmed={disabled}
		danger={danger}
		expanded={false}
		onToggle={(): void => action?.()}
		chevron={action ? ENTRY_CHEVRONS.FORWARD : ENTRY_CHEVRONS.NONE}
	/>;
}

/**
 * A setting chosen among a few options, as a row of a list: its name above, the options below, so a
 * segmented control never stands alone without saying what it sets.
 */
export function ChoiceRow({label, caption, children}: {label: string; caption?: string; children: ReactNode}): ReactNode {
	const styles = useStyles();
	return <View style={styles.choice}>
		<View>
			<Text style={styles.entryLabel}>{label}</Text>
			{caption ? <Text style={styles.caption}>{caption}</Text> : null}
		</View>
		{children}
	</View>;
}

/**
 * A setting turned on or off, written like the rows around it: the whole line toggles it, not only the switch.
 * An unknown value, still on its way from the server, shows a spinner rather than a guess.
 */
export function SwitchRow({label, caption, emblem, value, onChange, disabled = false, testID}: {
	label: string;
	caption?: string;
	emblem?: ReactNode;
	value: boolean | undefined;
	onChange: (value: boolean) => void;
	disabled?: boolean;
	testID?: string;
}): ReactNode {
	const colors = useColors();
	const known = value !== undefined;
	const toggle = (): void => {
		if (known && !disabled) onChange(!value);
	};
	return <ExpandableEntry
		{...emblem ? {emblem} : {}}
		label={label}
		{...caption === undefined ? {} : {caption}}
		{...testID === undefined ? {} : {testID}}
		end={known
			? <Switch
				accessibilityLabel={label}
				value={value}
				disabled={disabled}
				onValueChange={onChange}
				trackColor={{false: colors.line, true: colors.green}}
			/>
			: <ActivityIndicator size="small" color={colors.muted} />}
		expanded={false}
		onToggle={toggle}
		chevron={ENTRY_CHEVRONS.NONE}
	/>;
}

/** A bounded value, told as a sentence and drawn as a bar. */
export function Gauge({label, value, ratio, color}: {
	label: string;
	value: string;
	ratio: number;
	color: string;
}): ReactNode {
	const styles = useStyles();
	return <View style={styles.gauge}>
		<View style={styles.gaugeTop}>
			<TwemojiText containerStyle={styles.factLabelBox} textStyle={styles.factLabel} emojiSize={Theme.fontSize.caption}>{label}</TwemojiText>
			<TwemojiText textStyle={styles.gaugeValue} emojiSize={Theme.fontSize.caption}>{value}</TwemojiText>
		</View>
		<View style={styles.gaugeTrack}>
			<View style={[styles.gaugeFill, {width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: color}]} />
		</View>
	</View>;
}

/** What a screen needs to write a line in the same hand as these blocks, taken from their own sheet. */
export function useSectionStyles(): {caption: TextStyle; value: ViewStyle; amount: TextStyle; you: TextStyle; gauge: ViewStyle} {
	const styles = useStyles();
	return useMemo(() => ({
		caption: styles.caption,
		value: styles.figureValue,
		amount: styles.figureAmount,
		you: styles.you,
		gauge: styles.lineGauge
	}), [styles]);
}
