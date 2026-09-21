import {ReactNode} from "react";
import {ActivityIndicator, Modal, Pressable, StyleSheet, Text, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {UnitIcon} from "@/src/components/UnitIcon";
import {ArrowRight, ChevronDown, ChevronRight, CircleAlert, LucideIcon} from "@/src/design/FightIcons";
import {Screen} from "@/src/design/Primitives";
import {SwipeBack} from "@/src/design/SwipeBack";
import {Theme} from "@/src/design/Theme";
import {TwemojiText} from "@/src/design/TwemojiText";

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
	figureEnd: {alignItems: "flex-end"},
	figureValue: {flexDirection: "row", alignItems: "center", gap: 4},
	figureAmount: {fontFamily: Theme.fonts.bold, fontSize: Theme.fontSize.title, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	banner: {minHeight: 52, paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.md, borderRadius: Theme.pillRadius, backgroundColor: Theme.colors.ink, flexDirection: "row", alignItems: "center", gap: Theme.spacing.md},
	bannerIcon: {width: 20, height: 20, alignItems: "center", justifyContent: "center"},
	bannerLabel: {flex: 1, fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.button, lineHeight: Theme.lineHeight.body, color: Theme.colors.paper},
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
	factLabel: {flex: 1, minWidth: 0, fontFamily: Theme.fonts.medium, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.muted},
	factValue: {flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 4},
	factAmount: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.rowTitle, lineHeight: Theme.lineHeight.body, color: Theme.colors.ink, fontVariant: ["tabular-nums"], textAlign: "right"},
	gauge: {paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.md, gap: 6, borderBottomWidth: 1, borderColor: Theme.colors.line},
	gaugeTop: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.md},
	gaugeValue: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.caption, lineHeight: Theme.lineHeight.rowSubtitle, color: Theme.colors.ink, fontVariant: ["tabular-nums"]},
	gaugeTrack: {height: 5, borderRadius: 999, backgroundColor: Theme.colors.line, overflow: "hidden"},
	gaugeFill: {height: "100%", borderRadius: 999}
});

/** Why an action cannot be taken, so the screen can say it instead of letting the player find out. */
export type Lock = {reason: string; icon?: LucideIcon};

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
			<Text style={styles.title} numberOfLines={2}>{title}</Text>
			{subtitle ? <Text style={styles.caption}>{subtitle}</Text> : null}
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
	return <Modal visible animationType="slide" onRequestClose={onClose} {...onShow ? {onShow} : {}}>
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
	</Modal>;
}

/** One headline number, with the game emoji of its unit when it has one. */
export type Figure = {caption: string; value: string; unit?: string};

export function Figures({items}: {items: Figure[]}): ReactNode {
	return <View style={styles.figures}>{items.map((figure, index) => <View key={figure.caption} style={[styles.figure, index === items.length - 1 && index > 0 && styles.figureEnd]}>
		<Text style={styles.caption}>{figure.caption}</Text>
		<View style={styles.figureValue}>
			<Text style={styles.figureAmount}>{figure.value}</Text>
			{figure.unit ? <UnitIcon unit={figure.unit} size={15} /> : null}
		</View>
	</View>)}</View>;
}

export function ActionBanner({icon: Icon, label, onPress, pending = false, lock, testID}: {
	icon: LucideIcon;
	label: string;
	onPress: () => void;
	pending?: boolean;
	lock?: Lock;
	testID?: string;
}): ReactNode {
	const blocked = pending || Boolean(lock);
	return <View>
		<Pressable
			accessibilityRole="button"
			accessibilityState={{disabled: blocked, busy: pending}}
			disabled={blocked}
			onPress={onPress}
			style={({pressed}): object[] => [styles.banner, blocked && styles.disabled, pressed && styles.pressed].filter(Boolean) as object[]}
		>
			<View style={styles.bannerIcon}>{pending ? <ActivityIndicator size="small" color={Theme.colors.paper} /> : <Icon size={20} color={Theme.colors.paper} />}</View>
			<Text style={styles.bannerLabel}>{label}</Text>
			<ArrowRight size={18} color={Theme.colors.paper} />
		</Pressable>
		{lock ? <LockHint lock={lock} testID={testID} /> : null}
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
		<TwemojiText textStyle={styles.factLabel} emojiSize={Theme.fontSize.caption}>{label}</TwemojiText>
		{end !== undefined && typeof end !== "string"
			? end
			: <View style={styles.factValue}>
				<TwemojiText textStyle={styles.factAmount} emojiSize={Theme.fontSize.rowTitle}>{typeof end === "string" ? end : value ?? ""}</TwemojiText>
				{unit ? <UnitIcon unit={unit} size={15} /> : null}
			</View>}
	</View>;
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
	const trailing = typeof end === "string"
		? <TwemojiText textStyle={styles.caption} emojiSize={Theme.fontSize.caption}>{end}</TwemojiText>
		: end;
	return <ExpandableEntry
		{...emblem ? {emblem} : {}}
		label={title}
		{...subtitle === undefined ? {} : {caption: subtitle}}
		{...trailing === undefined ? {} : {end: trailing}}
		{...testID === undefined ? {} : {testID}}
		dimmed={disabled || danger}
		expanded={false}
		onToggle={(): void => {
			if (!disabled) onPress?.();
		}}
		chevron={onPress && !disabled ? ENTRY_CHEVRONS.FORWARD : ENTRY_CHEVRONS.NONE}
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
			<TwemojiText textStyle={styles.factLabel} emojiSize={Theme.fontSize.caption}>{label}</TwemojiText>
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
