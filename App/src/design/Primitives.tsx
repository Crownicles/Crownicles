import {ReactNode, useEffect, useState} from "react";
import * as Haptics from "expo-haptics";
import {
	Animated,
	Easing,
	Pressable,
	type PressableProps,
	ScrollView,
	StyleSheet,
	Text,
	View,
	type StyleProp,
	type TextStyle,
	type ViewStyle
} from "react-native";
import {Theme} from "@/src/design/Theme";
import {LucideIcon} from "@/src/design/FightIcons";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {TwemojiText} from "@/src/design/TwemojiText";
import {useReducedMotion} from "@/src/store/useReducedMotion";

const screenStyles = StyleSheet.create({
	screenContent: {
		flexGrow: 1,
		paddingTop: Theme.spacing.screenTop,
		paddingHorizontal: Theme.spacing.xl,
		paddingBottom: Theme.spacing.screenBottom,
		backgroundColor: Theme.colors.wash
	},
	hero: { marginBottom: Theme.spacing.xl },
	eyebrow: {
		color: Theme.colors.muted,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.eyebrow,
		lineHeight: Theme.lineHeight.eyebrow,
		textTransform: "uppercase",
		letterSpacing: Theme.letterSpacing.eyebrow,
		marginBottom: Theme.spacing.headerGap
	},
	heroTitle: {
		marginBottom: Theme.spacing.titleGap
	},
	heroTitleText: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.extraBold,
		fontSize: Theme.fontSize.hero,
		letterSpacing: Theme.letterSpacing.hero,
		lineHeight: Theme.lineHeight.hero
	},
	heroSubtitle: {
		color: Theme.colors.muted,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.heroSubtitle
	},
	sectionHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.sectionActionGap,
		marginTop: Theme.spacing.sectionGap
	},
	sectionHeadFirst: {
		marginTop: 0
	},
	sectionTitle: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.sm,
		flexShrink: 1
	},
	sectionHeader: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.sectionHeader,
		letterSpacing: Theme.letterSpacing.sectionHeader,
		flexShrink: 1
	},
	sectionHint: {
		color: Theme.colors.faint,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.caption,
		flexShrink: 1,
		textAlign: "right"
	},
	sectionAction: {
		paddingVertical: 2,
		paddingLeft: Theme.spacing.sm
	},
	sectionActionText: {
		color: Theme.colors.blue,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.bodySmall
	},
	rowDisabled: {
		opacity: 0.5
	},
	empty: {
		paddingVertical: Theme.spacing.xl,
		paddingHorizontal: Theme.spacing.lg,
		alignItems: "center"
	},
	emptyText: {
		color: Theme.colors.muted,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.note,
		lineHeight: Theme.lineHeight.note,
		textAlign: "center"
	}
});

const fieldStyles = StyleSheet.create({
	keyValue: {
		flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Theme.spacing.md, paddingVertical: 10, paddingHorizontal: Theme.spacing.lg
	},
	keyValueLabel: { color: Theme.colors.muted, fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.body, lineHeight: Theme.lineHeight.body },
	keyValueLabelContainer: { flexShrink: 1 },
	keyValueValue: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		flexShrink: 1,
		textAlign: "right"
	},
	keyValueValueContainer: { flexShrink: 1, alignItems: "flex-end" },
	stat: { paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg },
	statHead: {
		flexDirection: "row", justifyContent: "space-between", marginBottom: Theme.spacing.sm
	},
	track: {
		height: 5, borderRadius: 3, backgroundColor: Theme.colors.line, overflow: "hidden"
	},
	fill: { height: "100%", borderRadius: 3 },
	note: {
		paddingVertical: Theme.spacing.noteVertical,
		paddingHorizontal: Theme.spacing.lg,
	},
	noteText: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.note,
		lineHeight: Theme.lineHeight.note,
		color: Theme.colors.muted
	}
});

const actionStyles = StyleSheet.create({
	buttonRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 9,
		marginTop: 14
	},
	button: {
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.buttonHorizontal,
		borderWidth: 1,
		borderColor: Theme.colors.line,
		borderRadius: Theme.pillRadius,
		backgroundColor: Theme.colors.paper
	},
	buttonPressed: {
		backgroundColor: Theme.colors.wash,
		transform: [{scale: 0.985}]
	},
	buttonPrimary: {
		borderColor: Theme.colors.ink,
		backgroundColor: Theme.colors.ink
	},
	buttonDanger: {
		borderColor: Theme.colors.line
	},
	buttonText: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.button,
	},
	buttonLabel: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.sm
	},
	buttonPrimaryText: {
		color: Theme.colors.paper
	},
	buttonDangerText: {
		color: Theme.colors.red
	}
});

const quickActionStyles = StyleSheet.create({
	quickActions: {
		flexDirection: "row",
		gap: Theme.spacing.sm,
		marginTop: Theme.spacing.lg,
		marginBottom: Theme.spacing.xs
	},
	quickAction: {
		flex: 1,
		minHeight: Theme.dimensions.quickActionHeight,
		alignItems: "center",
		justifyContent: "center",
		gap: Theme.spacing.xs,
		paddingVertical: Theme.spacing.quickActionVertical,
		paddingHorizontal: Theme.spacing.xs,
		borderWidth: 1,
		borderColor: Theme.colors.line,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.paper
	},
	quickActionPressed: {
		backgroundColor: Theme.colors.wash
	},
	quickActionSlot: {flex: 1},
	quickActionLabel: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.caption,
		lineHeight: Theme.lineHeight.tabLabel,
		textAlign: "center"
	}
});

const styles = {
	...screenStyles,
	...fieldStyles,
	...actionStyles,
	...quickActionStyles
};

type ButtonVariant = "secondary" | "primary" | "danger";

type ButtonProps = {
	children: string;
	onPress?: () => void;
	variant?: ButtonVariant;
	disabled?: boolean;
	icon?: LucideIcon;

	/** A game emoji telling the action at a glance, drawn where `icon` would be. */
	emoji?: string;
};

type QuickActionProps = {
	icon: string;
	children: string;
	onPress?: () => void;
	disabled?: boolean;

	/** The action is on its way to the server: it spins instead of looking unavailable. */
	pending?: boolean;
};

const buttonVariantStyles = {
	secondary: {button: undefined, text: undefined},
	primary: {button: styles.buttonPrimary, text: styles.buttonPrimaryText},
	danger: {button: styles.buttonDanger, text: styles.buttonDangerText}
} satisfies Record<ButtonVariant, {button: StyleProp<ViewStyle>; text: StyleProp<TextStyle>}>;

/**
 * Building blocks of `App/mockups/mobile.html`: a bordered card, key/value rows, section headers,
 * a progress bar and a footnote.
 */

export function Screen({ children, contentContainerStyle }: {
	children: ReactNode;
	contentContainerStyle?: StyleProp<ViewStyle>;
}): ReactNode {
	return <ScrollView contentContainerStyle={[styles.screenContent, contentContainerStyle]}>{children}</ScrollView>;
}

export function SectionHeader({ children, action, icon, first = false }: {
	children: string;

	/** The game emoji of what the section holds, when it has one. */
	icon?: string;
	action?: { label?: string; hint?: string; onPress?: () => void };
	first?: boolean;
}): ReactNode {
	return (
		<View style={[styles.sectionHead, first && styles.sectionHeadFirst]}>
			<View style={styles.sectionTitle}>
				{icon ? <TwemojiIcon emoji={icon} size={Theme.fontSize.note} /> : null}
				<Text style={styles.sectionHeader}>{children}</Text>
			</View>
			{action?.hint ? <Text style={styles.sectionHint}>{action.hint}</Text> : null}
			{action?.label && action.onPress ? (
				<Pressable accessibilityRole="button" onPress={action.onPress} style={styles.sectionAction}>
					<Text style={styles.sectionActionText}>{action.label}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

export function Note({ children }: { children: string }): ReactNode {
	return <TwemojiText containerStyle={styles.note} textStyle={styles.noteText} emojiSize={Theme.fontSize.note}>{children}</TwemojiText>;
}

function getButtonStyle(variant: ButtonVariant, disabled: boolean, pressed = false): StyleProp<ViewStyle> {
	return [
		styles.button,
		buttonVariantStyles[variant].button,
		pressed && styles.buttonPressed,
		disabled && styles.rowDisabled
	];
}

export function Button({children, onPress, variant = "secondary", disabled = false, icon: Icon, emoji}: ButtonProps): ReactNode {
	const button = (
		<View style={styles.buttonLabel}>
			{emoji ? <TwemojiIcon emoji={emoji} size={Theme.fontSize.rowTitle} /> : null}
			{Icon && !emoji ? <Icon size={16} color={variant === "primary" ? Theme.colors.paper : Theme.colors.ink} /> : null}
			<Text style={[styles.buttonText, buttonVariantStyles[variant].text]}>
				{children}
			</Text>
		</View>
	);

	if (!onPress) {
		return <View style={getButtonStyle(variant, disabled)}>{button}</View>;
	}

	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({pressed}) => getButtonStyle(variant, disabled, pressed)}
		>
			{button}
		</Pressable>
	);
}

export function ButtonRow({ children }: { children: ReactNode }): ReactNode {
	return <View style={styles.buttonRow}>{children}</View>;
}

export function QuickActions({ children }: { children: ReactNode }): ReactNode {
	return <View style={styles.quickActions}>{children}</View>;
}

/** How far a quick action sinks under the finger, and how far its emoji jumps once released. */
const QUICK_ACTION_MOTION = {pressedScale: 0.93, iconPop: 1.35} as const;

function spring(value: Animated.Value, toValue: number, bounciness: number): void {
	Animated.spring(value, {toValue, bounciness, speed: 28, useNativeDriver: true}).start();
}

/** A control pressed many times a session: it sinks under the finger, springs back, its emoji pops and the phone taps back. */
export function usePressMotion(onPress: () => void): {scale: Animated.Value; iconScale: Animated.Value; handlers: Pick<PressableProps, "onPressIn" | "onPressOut" | "onPress">} {
	const reducedMotion = useReducedMotion();
	const [scale] = useState(() => new Animated.Value(1));
	const [iconScale] = useState(() => new Animated.Value(1));
	return {
		scale,
		iconScale,
		handlers: {
			onPressIn: (): void => {
				if (!reducedMotion) spring(scale, QUICK_ACTION_MOTION.pressedScale, 0);
			},
			onPressOut: (): void => {
				if (!reducedMotion) spring(scale, 1, 14);
			},
			onPress: (): void => {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
				if (!reducedMotion) {
					iconScale.setValue(QUICK_ACTION_MOTION.iconPop);
					spring(iconScale, 1, 18);
				}
				onPress();
			}
		}
	};
}

/** While the server answers, the control's own icon flips and hops like a tossed coin. */
const PENDING_MOTION = {turnMs: 850, hop: -6, perspective: 400, dimmedOpacity: 0.35} as const;

export function PendingMotion({children}: {children: ReactNode}): ReactNode {
	const reducedMotion = useReducedMotion();
	const [turn] = useState(() => new Animated.Value(0));
	useEffect(() => {
		const loop = Animated.loop(Animated.timing(turn, {toValue: 1, duration: PENDING_MOTION.turnMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true}));
		loop.start();
		return (): void => loop.stop();
	}, [turn]);
	const style = reducedMotion
		? {opacity: turn.interpolate({inputRange: [0, 0.5, 1], outputRange: [1, PENDING_MOTION.dimmedOpacity, 1]})}
		: {transform: [
			{perspective: PENDING_MOTION.perspective},
			{translateY: turn.interpolate({inputRange: [0, 0.5, 1], outputRange: [0, PENDING_MOTION.hop, 0]})},
			{rotateY: turn.interpolate({inputRange: [0, 1], outputRange: ["0deg", "360deg"]})}
		]};
	return <Animated.View style={style} testID="pending-motion">{children}</Animated.View>;
}

function QuickActionContent({icon, label, pending, iconScale}: {icon: string; label: string; pending: boolean; iconScale?: Animated.Value}): ReactNode {
	return <>
		{pending
			? <PendingMotion><TwemojiIcon emoji={icon} size={Theme.dimensions.quickActionIcon} /></PendingMotion>
			: <Animated.View style={iconScale ? {transform: [{scale: iconScale}]} : undefined}>
				<TwemojiIcon emoji={icon} size={Theme.dimensions.quickActionIcon} />
			</Animated.View>}
		<Text style={styles.quickActionLabel}>{label}</Text>
	</>;
}

function PressableQuickAction({icon, children, onPress, disabled, pending}: Required<QuickActionProps>): ReactNode {
	const {scale, iconScale, handlers} = usePressMotion(onPress);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{disabled: disabled || pending, busy: pending}}
			disabled={disabled || pending}
			{...handlers}
			style={styles.quickActionSlot}
		>
			{({pressed}): ReactNode => <Animated.View style={[
				styles.quickAction,
				pressed && styles.quickActionPressed,
				disabled && !pending && styles.rowDisabled,
				{transform: [{scale}]}
			]}>
				<QuickActionContent icon={icon} label={children} pending={pending} iconScale={iconScale} />
			</Animated.View>}
		</Pressable>
	);
}

export function QuickAction({icon, children, onPress, disabled = false, pending = false}: QuickActionProps): ReactNode {
	if (!onPress) {
		return <View style={[styles.quickAction, disabled && !pending && styles.rowDisabled]}>
			<QuickActionContent icon={icon} label={children} pending={pending} />
		</View>;
	}
	return <PressableQuickAction icon={icon} onPress={onPress} disabled={disabled} pending={pending}>{children}</PressableQuickAction>;
}

export function EmptyState({ children }: { children: string }): ReactNode {
	return (
		<View style={styles.empty}>
			<Text style={styles.emptyText}>{children}</Text>
		</View>
	);
}
