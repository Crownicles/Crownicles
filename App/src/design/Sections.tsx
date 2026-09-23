import {ReactNode, useEffect, useState} from "react";
import {Animated, Modal, ModalProps, Pressable, StyleSheet, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {UnitIcon} from "@/src/components/UnitIcon";
import {ArrowRight, ChevronDown, ChevronRight, CircleAlert, LucideIcon} from "@/src/design/FightIcons";
import {PendingMotion, Screen, usePressMotion} from "@/src/design/Primitives";
import {SwipeBack} from "@/src/design/SwipeBack";
import {Theme} from "@/src/design/Theme";
import {TwemojiText} from "@/src/design/TwemojiText";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

/**
 * The grammar every detail screen is written in: an identity banner, a row of figures, a dark
 * call to action that says beforehand why it cannot be pressed, and expandable lists.
 */

const styles = StyleSheet.create({
	surface: {flex: 1, backgroundColor: Theme.colors.paper},
	standing: {paddingBottom: Theme.spacing.xl, gap: Theme.spacing.lg},
	identity: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.lg},
	emblem: {width: 64, height: 64, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.wash, borderRadius: 8},
	body: {flex: 1, minWidth: 0, gap: 3},
	caption: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	title: {fontFamily: Theme.fonts.extraBold, fontSize: 23, lineHeight: 29, color: Theme.colors.ink},
	chevron: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.chevron, color: Theme.colors.faint},
	figures: {flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: Theme.colors.line, paddingVertical: Theme.spacing.xl},
	figure: {flex: 1, minWidth: 0, gap: 6},
	figureSingle: {alignItems: "center", justifyContent: "space-between"},
	figureEnd: {alignItems: "flex-end"},
	figureValue: {flexDirection: "row", alignItems: "center", gap: 4},
	figureAmount: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	banner: {minHeight: 52, paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md, borderRadius: Theme.pillRadius, backgroundColor: Theme.colors.ink, flexDirection: "row", alignItems: "center", gap: Theme.spacing.md},
	bannerIcon: {width: 24, height: 24, alignItems: "center", justifyContent: "center"},
	bannerLabelBox: {flex: 1},
	bannerLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.button, lineHeight: Theme.lineHeight.body, color: Theme.colors.paper},
	lock: {flexDirection: "row", alignItems: "center", gap: Theme.spacing.sm, paddingTop: Theme.spacing.md},
	lockText: {flex: 1, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	disabled: {opacity: 0.5},
	pressed: {opacity: 0.7},
	list: {borderTopWidth: 1, borderColor: Theme.colors.line},
	entry: {borderBottomWidth: 1, borderColor: Theme.colors.line},
	entryHeader: {minHeight: 72, flexDirection: "row", alignItems: "center", gap: Theme.spacing.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, borderLeftWidth: 3, borderLeftColor: "transparent"},
	expanded: {backgroundColor: Theme.colors.wash},
	highlighted: {borderLeftColor: Theme.colors.green},
	dimmed: {opacity: 0.45},
	entryEmblem: {width: 32, height: 32, flexShrink: 0, alignItems: "center", justifyContent: "center"},
	entryLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: Theme.colors.ink},
	chevronOpen: {transform: [{rotate: "180deg"}]},
	details: {backgroundColor: Theme.colors.wash, paddingHorizontal: Theme.spacing.lg, paddingBottom: Theme.spacing.lg, gap: Theme.spacing.md},
	back: {width: 34, height: 34, borderRadius: 17, backgroundColor: Theme.colors.wash, alignItems: "center", justifyContent: "center", marginBottom: Theme.spacing.lg},
	/** The icon set only ships a downward chevron; a quarter turn points it back. */
	backChevron: {transform: [{rotate: "90deg"}]},
	fact: {minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.md, paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, borderBottomWidth: 1, borderColor: Theme.colors.line},
	// TwemojiText applies textStyle to its inner Text: a flex there would stretch the line to the full row.
	factLabelBox: {flex: 1, minWidth: 0},
	factLabel: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	factValue: {flexShrink: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4},
	factAmount: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: Theme.colors.ink, fontVariant: ["tabular-nums"], textAlign: "right"},
	gauge: {paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, gap: 6, borderBottomWidth: 1, borderColor: Theme.colors.line},
	gaugeTop: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.md},
	gaugeValue: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	gaugeTrack: {height: 5, borderRadius: 999, backgroundColor: Theme.colors.line, overflow: "hidden"},
	gaugeFill: {height: "100%", borderRadius: 999},
	toastLayer: {...StyleSheet.absoluteFill, paddingHorizontal: Theme.spacing.lg},
	toast: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.md,
		paddingVertical: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.lg,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.ink,
		shadowColor: Theme.colors.shadow,
		shadowOpacity: 0.25,
		shadowRadius: 14,
		shadowOffset: {width: 0, height: 6},
		elevation: 8
	},
	toastEmblem: {width: 40, height: 40, flexShrink: 0, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.paper},
	toastTitle: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: Theme.colors.paper},
	toastSubtitle: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.faint},
	toastAmount: {fontFamily: Theme.fonts.extraBold, fontSize: Theme.fontSize.title, color: Theme.colors.paper, fontVariant: ["tabular-nums"]},
	effects: {flexDirection: "row", flexWrap: "wrap", gap: Theme.spacing.sm},
	effect: {flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingLeft: Theme.spacing.sm, paddingRight: Theme.spacing.md, borderRadius: Theme.pillRadius},
	effectLabel: {fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	effectValue: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, fontVariant: ["tabular-nums"]},
	effectGain: {color: Theme.colors.green},
	effectLoss: {color: Theme.colors.red},
	effectNeutral: {color: Theme.colors.ink},
	effectGainChip: {backgroundColor: Theme.colors.greenWash},
	effectLossChip: {backgroundColor: Theme.colors.redWash},
	effectNeutralChip: {backgroundColor: Theme.colors.wash},
	journal: {
		marginBottom: Theme.spacing.xl,
		padding: Theme.spacing.xl,
		gap: Theme.spacing.lg,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.paper,
		shadowColor: Theme.colors.shadow,
		shadowOpacity: 0.06,
		shadowRadius: 12,
		shadowOffset: {width: 0, height: 4},
		elevation: 2
	},
	journalEmblem: {width: 44, height: 44, flexShrink: 0, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: Theme.colors.wash},
	journalTitle: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: Theme.colors.ink},
	card: {
		marginBottom: Theme.spacing.xl,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.paper,
		shadowColor: Theme.colors.shadow,
		shadowOpacity: 0.06,
		shadowRadius: 12,
		shadowOffset: {width: 0, height: 4},
		elevation: 2
	},
	// The shadow lives on the outer view: clipping it there would erase it.
	cardClip: {borderRadius: Theme.radius, overflow: "hidden"}
});

/** Why an action cannot be taken, so the screen can say it instead of letting the player find out. */
export type Lock = {reason: string; icon?: LucideIcon};

/** Whether a consequence helps the player, hurts them, or only tells them something. */
export const EFFECT_TONES = {GAIN: "gain", LOSS: "loss", NEUTRAL: "neutral"} as const;
export type EffectTone = typeof EFFECT_TONES[keyof typeof EFFECT_TONES];

/** One consequence on the player, drawn with the game emoji of what changed: a unit, or any emoji of the game. */
export type Effect = {label: string; value: string; tone: EffectTone; unit?: string; emoji?: string};

const EFFECT_EMBLEM_SIZE = 15;
const EFFECT_TONE_STYLES = {
	[EFFECT_TONES.GAIN]: {value: styles.effectGain, chip: styles.effectGainChip},
	[EFFECT_TONES.LOSS]: {value: styles.effectLoss, chip: styles.effectLossChip},
	[EFFECT_TONES.NEUTRAL]: {value: styles.effectNeutral, chip: styles.effectNeutralChip}
};

function EffectEmblem({effect}: {effect: Effect}): ReactNode {
	if (effect.unit) return <UnitIcon unit={effect.unit} size={EFFECT_EMBLEM_SIZE} />;
	return effect.emoji ? <TwemojiIcon emoji={effect.emoji} size={EFFECT_EMBLEM_SIZE} /> : null;
}

/** What an event did to the player, one tinted chip per change: green when it helps, red when it hurts. */
export function Effects({items}: {items: Effect[]}): ReactNode {
	return <View style={styles.effects}>{items.map(effect => <View key={effect.label} style={[styles.effect, EFFECT_TONE_STYLES[effect.tone].chip]} testID="event-effect">
		<EffectEmblem effect={effect} />
		<Text style={styles.effectLabel}>{effect.label}</Text>
		<Text style={[styles.effectValue, EFFECT_TONE_STYLES[effect.tone].value]}>{effect.value}</Text>
	</View>)}</View>;
}

/**
 * An entry of the adventure journal, laid out in the order Discord posts it: whose journal it is
 * with the event's emoji, what the event changed, then the game's own prose.
 */
export function JournalEntry({emblem, title, effects, children}: {
	emblem?: ReactNode;
	title: string;
	effects: Effect[];
	children: ReactNode;
}): ReactNode {
	return <View style={styles.journal}>
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
	return <View style={styles.card}><View style={styles.cardClip}>{children}</View></View>;
}

const TOAST_DURATION_MS = 4_000;
const TOAST_ENTRANCE_MS = 220;
const TOAST_ENTRANCE_OFFSET = -24;
const TOAST_UNIT_SIZE = 18;
const STANDING_TITLE_EMOJI_SIZE = 22;
const BANNER_EMOJI_SIZE = 22;

/** The gain a toast announces, as a number and the game emoji of its unit. */
export type ToastValue = {amount: string; unit: string};

function ToastContent({emblem, title, subtitle, value}: {emblem?: ReactNode; title: string; subtitle?: string; value?: ToastValue}): ReactNode {
	return <>
		{emblem ? <View style={styles.toastEmblem}>{emblem}</View> : null}
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
 * A short acknowledgement floating over the screen, which leaves by itself; a tap sends it away sooner.
 * `onDismiss` must keep its identity across renders, or the countdown restarts.
 */
export function Toast({emblem, title, subtitle, value, onDismiss}: {
	emblem?: ReactNode;
	title: string;
	subtitle?: string;
	value?: ToastValue;
	onDismiss: () => void;
}): ReactNode {
	const insets = useSafeAreaInsets();
	const [entrance] = useState(() => new Animated.Value(0));
	useEffect(() => {
		Animated.timing(entrance, {toValue: 1, duration: TOAST_ENTRANCE_MS, useNativeDriver: true}).start();
		const timer = setTimeout(onDismiss, TOAST_DURATION_MS);
		return (): void => clearTimeout(timer);
	}, [entrance, onDismiss]);
	return <View pointerEvents="box-none" style={[styles.toastLayer, {paddingTop: insets.top + Theme.spacing.sm}]}>
		<Animated.View style={{opacity: entrance, transform: [{translateY: entrance.interpolate({inputRange: [0, 1], outputRange: [TOAST_ENTRANCE_OFFSET, 0]})}]}}>
			<Pressable
				accessibilityRole="alert"
				accessibilityLiveRegion="polite"
				onPress={onDismiss}
				style={styles.toast}
			>
				<ToastContent emblem={emblem} title={title} {...subtitle ? {subtitle} : {}} {...value ? {value} : {}} />
			</Pressable>
		</Animated.View>
	</View>;
}

/** React Native paints a full-screen modal white until its content lays out: the palette avoids a flash in dark mode. */
export function SheetModal(props: Omit<ModalProps, "animationType" | "backdropColor">): ReactNode {
	return <Modal animationType="slide" backdropColor={Theme.colors.paper} {...props} />;
}

/** A full-screen modal is its own window on iOS, where `SafeAreaView` measures nothing: apply the insets here. */
export function ModalSurface({children, tone = "paper"}: {children: ReactNode; tone?: "paper" | "wash"}): ReactNode {
	const insets = useSafeAreaInsets();
	return <View style={[styles.surface, {backgroundColor: Theme.colors[tone], paddingTop: insets.top, paddingBottom: insets.bottom}]}>{children}</View>;
}

export function LockHint({lock, testID}: {lock: Lock; testID?: string}): ReactNode {
	const Icon = lock.icon ?? CircleAlert;
	return <View style={styles.lock} testID={testID}>
		<Icon size={15} color={Theme.colors.muted} />
		<Text style={styles.lockText}>{lock.reason}</Text>
	</View>;
}

export function BackButton({label, onClose}: {label: string; onClose: () => void}): ReactNode {
	return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onClose} style={({pressed}): object[] => [styles.back, pressed && styles.pressed].filter(Boolean) as object[]}>
		<View style={styles.backChevron}><ChevronDown size={18} color={Theme.colors.ink} /></View>
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
	const identity = <>
		{emblem ? <View style={styles.emblem}>{emblem}</View> : null}
		<View style={styles.body}>
			<Text style={styles.caption}>{caption}</Text>
			<TwemojiText textStyle={styles.title} emojiSize={STANDING_TITLE_EMOJI_SIZE}>{title}</TwemojiText>
			{subtitle ? <TwemojiText textStyle={styles.caption} emojiSize={Theme.fontSize.caption}>{subtitle}</TwemojiText> : null}
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
	return <SheetModal visible onRequestClose={onClose} {...onShow ? {onShow} : {}}>
		<ModalSurface>
			{/* A window is left the same way a pushed page is: the button, the hardware back, or the edge gesture. */}
			<SwipeBack onClose={onClose}>
				<Screen>
					<BackButton label={closeLabel} onClose={onClose} />
					<Standing caption={caption} title={title} {...subtitle ? {subtitle} : {}} {...emblem ? {emblem} : {}} />
					{children}
				</Screen>
			</SwipeBack>
		</ModalSurface>
	</SheetModal>;
}

/** One headline number, with the game emoji of its unit when it has one. */
export type Figure = {caption: string; value: string; unit?: string};

function FigureValue({figure}: {figure: Figure}): ReactNode {
	return <View style={styles.figureValue}>
		<Text style={styles.figureAmount}>{figure.value}</Text>
		{figure.unit ? <UnitIcon unit={figure.unit} size={15} /> : null}
	</View>;
}

/** Side by side when there are several; a lone figure spans the line instead of sitting in a corner. */
export function Figures({items}: {items: Figure[]}): ReactNode {
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

export function ActionBanner({icon: Icon, emoji, label, onPress, pending = false, lock, hint, testID}: {
	icon: LucideIcon;

	/** A game emoji drawn instead of `icon`, when the action spends or earns something the game draws. */
	emoji?: string;
	label: string;
	onPress: () => void;
	pending?: boolean;
	lock?: Lock;

	/** What the player should know before pressing, without preventing the press. */
	hint?: Lock;
	testID?: string;
}): ReactNode {
	const blocked = pending || Boolean(lock);
	const {scale, iconScale, handlers} = usePressMotion(onPress);
	const glyph = emoji ? <TwemojiIcon emoji={emoji} size={BANNER_EMOJI_SIZE} /> : <Icon size={20} color={Theme.colors.paper} />;
	const notice = lock ?? hint;
	return <View>
		<Pressable
			accessibilityRole="button"
			accessibilityState={{disabled: blocked, busy: pending}}
			disabled={blocked}
			{...handlers}
		>
			{({pressed}): ReactNode => <Animated.View style={[styles.banner, blocked && styles.disabled, pressed && styles.pressed, {transform: [{scale}]}]}>
				<View style={styles.bannerIcon}>
					{pending ? <PendingMotion>{glyph}</PendingMotion> : <Animated.View style={{transform: [{scale: iconScale}]}}>{glyph}</Animated.View>}
				</View>
				<TwemojiText containerStyle={styles.bannerLabelBox} textStyle={styles.bannerLabel} emojiSize={Theme.fontSize.button}>{label}</TwemojiText>
				<ArrowRight size={18} color={Theme.colors.paper} />
			</Animated.View>}
		</Pressable>
		{notice ? <LockHint lock={notice} testID={testID} /> : null}
	</View>;
}

export function ExpandableList({children}: {children: ReactNode}): ReactNode {
	return <View style={styles.list}>{children}</View>;
}

/** Whether pressing an entry unfolds it, takes the player elsewhere, or does nothing at all. */
export const ENTRY_CHEVRONS = {
	EXPAND: "expand",
	FORWARD: "forward",
	NONE: "none"
} as const;
export type EntryChevron = typeof ENTRY_CHEVRONS[keyof typeof ENTRY_CHEVRONS];

function EntryChevronIcon({chevron, expanded}: {chevron: EntryChevron; expanded: boolean}): ReactNode {
	if (chevron === ENTRY_CHEVRONS.NONE) return null;
	if (chevron === ENTRY_CHEVRONS.FORWARD) return <ChevronRight size={16} color={Theme.colors.faint} />;
	return <View style={expanded && styles.chevronOpen}><ChevronDown size={16} color={Theme.colors.muted} /></View>;
}

export function ExpandableEntry({emblem, label, caption, end, expanded, onToggle, chevron = ENTRY_CHEVRONS.EXPAND, highlighted = false, dimmed = false, children, testID}: {
	emblem?: ReactNode;
	label: string;
	caption?: ReactNode;
	end?: ReactNode;
	expanded: boolean;
	onToggle: () => void;
	chevron?: EntryChevron;
	highlighted?: boolean;
	dimmed?: boolean;
	children?: ReactNode;
	testID?: string;
}): ReactNode {
	return <View style={styles.entry}>
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{selected: expanded, expanded}}
			onPress={onToggle}
			style={({pressed}): object[] => [styles.entryHeader, expanded && styles.expanded, highlighted && styles.highlighted, dimmed && !expanded && styles.dimmed, pressed && styles.pressed].filter(Boolean) as object[]}
		>
			{emblem ? <View style={styles.entryEmblem}>{emblem}</View> : null}
			<View style={styles.body}>
				<TwemojiText textStyle={styles.entryLabel} emojiSize={Theme.fontSize.rowTitle}>{label}</TwemojiText>
				{typeof caption === "string" ? <TwemojiText textStyle={styles.caption} emojiSize={Theme.fontSize.rowSubtitle}>{caption}</TwemojiText> : caption}
			</View>
			{end}
			<EntryChevronIcon chevron={chevron} expanded={expanded} />
		</Pressable>
		{expanded ? <View style={styles.details} testID={testID}>{children}</View> : null}
	</View>;
}

/** A plain statement of fact: what it is on the left, what it is worth on the right. */
export function Fact({label, value, unit, end}: {
	label: string;
	value?: string;
	unit?: string;
	end?: ReactNode;
}): ReactNode {
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

function rowTrailing(end: ReactNode): ReactNode {
	return typeof end === "string"
		? <TwemojiText textStyle={styles.caption} emojiSize={Theme.fontSize.caption}>{end}</TwemojiText>
		: end;
}

/** A row that leads somewhere rather than unfolding, written in the same hand as the entries. */
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
	const trailing = rowTrailing(end);
	const action = disabled ? undefined : onPress;
	return <ExpandableEntry
		{...emblem ? {emblem} : {}}
		label={title}
		{...subtitle === undefined ? {} : {caption: subtitle}}
		{...trailing === undefined ? {} : {end: trailing}}
		{...testID === undefined ? {} : {testID}}
		dimmed={disabled || danger}
		expanded={false}
		onToggle={(): void => action?.()}
		chevron={action ? ENTRY_CHEVRONS.FORWARD : ENTRY_CHEVRONS.NONE}
	/>;
}

/** A bounded value, told as a sentence and drawn as a bar. */
export function Gauge({label, value, ratio, color}: {
	label: string;
	value: string;
	ratio: number;
	color: string;
}): ReactNode {
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

/** What a screen needs to write a line in the same hand as these blocks. */
export const sectionStyles = StyleSheet.create({
	caption: styles.caption,
	value: styles.figureValue,
	amount: styles.figureAmount,
	you: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, color: Theme.colors.green},
	gauge: {paddingTop: Theme.spacing.lg}
});
