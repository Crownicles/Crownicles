import {ReactElement, useEffect, useMemo, useRef, useState} from "react";
import {Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, View} from "react-native";
import {selectionAsync} from "expo-haptics";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {LucideIcon} from "@/src/design/FightIcons";
import {CountBadge} from "@/src/design/Primitives";
import {ProgressRing} from "@/src/design/ProgressRing";
import {Theme} from "@/src/design/Theme";
import {createStyles, useColors} from "@/src/design/ThemeContext";
import {useReducedMotion} from "@/src/store/useReducedMotion";
import {TRAVEL_DASH_MS} from "@/src/store/TravelDashStore";
import {i18n} from "@/src/translations/i18n";

export type CapsuleTab = {
	name: string;
	title: string;
	Icon: LucideIcon;
	isNew: boolean;
	/** Draws a ring around the icon, filled that far. */
	progress?: number;

	/** How many rewards wait behind the tab, drawn as a pill on the icon. */
	badge?: number;
};

type CapsuleTabBarProps = {
	tabs: readonly CapsuleTab[];
	focused: string;
	/** The pager's position, fractional while a swipe is under way: the bar follows it frame by frame. */
	position: Animated.AnimatedInterpolation<number>;
	onSelect: (name: string) => void;
};

const CAPSULE = {height: 62, padding: 7, sideInset: 14, gapAbove: 8, minBottom: 12} as const;
const PILL_HEIGHT = CAPSULE.height - CAPSULE.padding * 2;
const ICON_SIZE = 22;
/** Beyond this much at once, the ring races rather than glides: tokens spent, or a report just opened. */
const RING = {size: 32, thickness: 2, leap: 0.1} as const;
/** How often the ring is given a new reading, and so how long it takes to glide to it. */
export const RING_TICK_MS = 5_000;
/** The focused tab takes this many shares of the width, the others one each. */
const FOCUSED_SHARE = 2.3;
const LABEL = {gap: 8, padding: 14} as const;
const CAPSULE_SHADOW = {opacity: 0.14, radius: 15, offsetY: 10, elevation: 8} as const;
const NEW_MARK_SIZE = 8;
/** The count pill leans out of the icon's corner without leaving the capsule. */
const BADGE_OFFSET = 6;
const FILL = {position: "absolute", top: 0, right: 0, bottom: 0, left: 0} as const;

const useStyles = createStyles(colors => ({
	bar: {paddingHorizontal: CAPSULE.sideInset, paddingTop: CAPSULE.gapAbove, backgroundColor: colors.wash},
	capsule: {
		height: CAPSULE.height,
		padding: CAPSULE.padding,
		borderRadius: CAPSULE.height / 2,
		backgroundColor: colors.paper,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.line,
		shadowColor: colors.shadow,
		shadowOpacity: CAPSULE_SHADOW.opacity,
		shadowRadius: CAPSULE_SHADOW.radius,
		shadowOffset: {width: 0, height: CAPSULE_SHADOW.offsetY},
		elevation: CAPSULE_SHADOW.elevation
	},
	track: {flex: 1},
	pill: {
		position: "absolute",
		top: 0,
		left: 0,
		height: PILL_HEIGHT,
		borderRadius: PILL_HEIGHT / 2,
		backgroundColor: colors.selection,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.line
	},
	icon: {position: "absolute", left: 0, top: (PILL_HEIGHT - RING.size) / 2, width: RING.size, height: RING.size},
	iconLayer: {...FILL, alignItems: "center", justifyContent: "center"},
	label: {
		position: "absolute",
		left: 0,
		top: 0,
		height: PILL_HEIGHT,
		lineHeight: PILL_HEIGHT,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.rowTitle,
		color: colors.selectionInk
	},
	hitArea: {position: "absolute", top: 0, height: PILL_HEIGHT},
	badge: {position: "absolute", top: -BADGE_OFFSET, right: -BADGE_OFFSET},
	newMark: {
		position: "absolute",
		top: 0,
		right: 0,
		width: NEW_MARK_SIZE,
		height: NEW_MARK_SIZE,
		borderRadius: NEW_MARK_SIZE / 2,
		backgroundColor: colors.gold,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.paper
	}
}));

/** How wide an idle tab and the focused one are, sharing the capsule's inner width. */
type Slots = {idle: number; focused: number};

function slotsOf(width: number, count: number): Slots {
	const idle = width / (count - 1 + FOCUSED_SHARE);
	return {idle, focused: idle * FOCUSED_SHARE};
}

function slotStart(index: number, focus: number, slots: Slots): number {
	return index * slots.idle + (index > focus ? slots.focused - slots.idle : 0);
}

function slotCenter(index: number, focus: number, slots: Slots): number {
	return slotStart(index, focus, slots) + (index === focus ? slots.focused : slots.idle) / 2;
}

/** A value laid out for each tab being the open one, blended while the pager moves from one to the next. */
function alongTabs(position: Animated.AnimatedInterpolation<number>, count: number, valueWhenOpen: (focus: number) => number): Animated.AnimatedInterpolation<number> {
	const inputRange = count > 1 ? Array.from({length: count}, (_, focus) => focus) : [0, 1];
	return position.interpolate({inputRange, outputRange: inputRange.map(focus => valueWhenOpen(Math.min(focus, count - 1))), extrapolate: "clamp"});
}

function TabGlyph({tab, color, ring}: {tab: CapsuleTab; color: string; ring: Animated.Value}): ReactElement {
	const icon = <tab.Icon size={ICON_SIZE} color={color} />;
	return tab.progress === undefined
		? icon
		: <ProgressRing progress={ring} size={RING.size} thickness={RING.thickness} color={color}>{icon}</ProgressRing>;
}

/**
 * Glides from one reading to the next over the time between them, races along a leap such as a dash to the
 * stop, and starts a new wait from empty at once rather than unwinding.
 */
function useRingProgress(target: number | undefined): Animated.Value {
	const still = useReducedMotion();
	const [ring] = useState(() => new Animated.Value(target ?? 0));
	const previous = useRef(target ?? 0);
	useEffect(() => {
		if (target === undefined) return;
		const step = target - previous.current;
		previous.current = target;
		if (still || step < 0) {
			ring.setValue(target);
			return;
		}
		const leap = step > RING.leap;
		Animated.timing(ring, {
			toValue: target,
			duration: leap ? TRAVEL_DASH_MS : RING_TICK_MS,
			easing: leap ? Easing.inOut(Easing.cubic) : Easing.linear,
			useNativeDriver: true
		}).start();
	}, [ring, still, target]);
	return ring;
}

type TabContentProps = {
	tab: CapsuleTab;
	index: number;
	count: number;
	slots: Slots;
	position: Animated.AnimatedInterpolation<number>;
	focused: boolean;
};

/** Icon and name of one tab; only transforms and opacity move, so the whole bar runs on the native thread. */
function TabContent({tab, index, count, slots, position, focused}: TabContentProps): ReactElement {
	const styles = useStyles();
	const colors = useColors();
	const ring = useRingProgress(tab.progress);
	const [labelWidth, setLabelWidth] = useState(0);
	const motion = useMemo(() => {
		const shown = position.interpolate({inputRange: [index - 1, index, index + 1], outputRange: [0, 1, 0], extrapolate: "clamp"});
		const iconCenter = (focus: number): number => slotCenter(index, focus, slots) - (focus === index ? (labelWidth + LABEL.gap) / 2 : 0);
		return {
			shown,
			hidden: shown.interpolate({inputRange: [0, 1], outputRange: [1, 0]}),
			iconX: alongTabs(position, count, focus => iconCenter(focus) - RING.size / 2),
			labelX: alongTabs(position, count, focus => iconCenter(focus) + RING.size / 2 + LABEL.gap)
		};
	}, [count, index, labelWidth, position, slots]);
	const measure = (event: LayoutChangeEvent): void => setLabelWidth(event.nativeEvent.layout.width);
	return <>
		<Animated.View style={[styles.icon, {transform: [{translateX: motion.iconX}]}]}>
			<Animated.View style={[styles.iconLayer, {opacity: motion.hidden}]}><TabGlyph tab={tab} color={colors.muted} ring={ring} /></Animated.View>
			<Animated.View style={[styles.iconLayer, {opacity: motion.shown}]}><TabGlyph tab={tab} color={colors.selectionInk} ring={ring} /></Animated.View>
			{tab.badge ? <View style={styles.badge}><CountBadge count={tab.badge} testID={`tab-badge-${tab.name}`} /></View> : null}
			{tab.isNew && !focused && !tab.badge ? <View style={styles.newMark} testID="tab-new-mark" /> : null}
		</Animated.View>
		<Animated.Text
			numberOfLines={1}
			onLayout={measure}
			style={[styles.label, {maxWidth: slots.focused - RING.size - LABEL.gap - LABEL.padding * 2, opacity: motion.shown, transform: [{translateX: motion.labelX}]}]}
		>
			{tab.title}
		</Animated.Text>
	</>;
}

/** A capsule floating above the screen's foot: the open tab widens into a pill that names it, following the swipe. */
export function CapsuleTabBar({tabs, focused, position, onSelect}: CapsuleTabBarProps): ReactElement {
	const styles = useStyles();
	const insets = useSafeAreaInsets();
	const [width, setWidth] = useState(0);
	const slots = useMemo(() => slotsOf(width, tabs.length), [tabs.length, width]);
	const pillX = useMemo(() => alongTabs(position, tabs.length, focus => focus * slots.idle), [position, slots, tabs.length]);
	const focusIndex = Math.max(tabs.findIndex(tab => tab.name === focused), 0);
	const select = (tab: CapsuleTab): void => {
		selectionAsync().catch(() => undefined);
		onSelect(tab.name);
	};
	return <View style={[styles.bar, {paddingBottom: Math.max(insets.bottom, CAPSULE.minBottom)}]}>
		<View style={styles.capsule}>
			<View style={styles.track} accessibilityRole="tablist" testID="capsule-track" onLayout={(event): void => setWidth(event.nativeEvent.layout.width)}>
				{width > 0 ? <>
					<Animated.View style={[styles.pill, {width: slots.focused, transform: [{translateX: pillX}]}]} />
					<View style={FILL} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
						{tabs.map((tab, index) => <TabContent key={tab.name} tab={tab} index={index} count={tabs.length} slots={slots} position={position} focused={tab.name === focused} />)}
					</View>
				</> : null}
				{tabs.map((tab, index) => <Pressable
					key={tab.name}
					onPress={(): void => select(tab)}
					accessibilityRole="tab"
					accessibilityLabel={tab.title}
					accessibilityState={{selected: tab.name === focused}}
					{...tab.badge ? {accessibilityValue: {text: i18n.t("app:common.toCollect", {count: tab.badge})}} : {}}
					style={[styles.hitArea, {left: slotStart(index, focusIndex, slots), width: index === focusIndex ? slots.focused : slots.idle}]}
					testID={`capsule-tab-${tab.name}`}
				/>)}
			</View>
		</View>
	</View>;
}
