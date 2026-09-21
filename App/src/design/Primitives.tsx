import {ReactNode} from "react";
import {
	Pressable,
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
};

type QuickActionProps = {
	icon: string;
	children: string;
	onPress?: () => void;
	disabled?: boolean;
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

export function Button({children, onPress, variant = "secondary", disabled = false, icon: Icon}: ButtonProps): ReactNode {
	const button = (
		<View style={styles.buttonLabel}>
			{Icon ? <Icon size={16} color={variant === "primary" ? Theme.colors.paper : Theme.colors.ink} /> : null}
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

export function QuickAction({icon, children, onPress, disabled = false}: QuickActionProps): ReactNode {
	const content = (
		<>
			<TwemojiIcon emoji={icon} size={Theme.dimensions.quickActionIcon} />
			<Text style={styles.quickActionLabel}>{children}</Text>
		</>
	);

	if (!onPress) {
		return <View style={[styles.quickAction, disabled && styles.rowDisabled]}>{content}</View>;
	}

	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({pressed}) => [styles.quickAction, pressed && styles.quickActionPressed, disabled && styles.rowDisabled]}
		>
			{content}
		</Pressable>
	);
}

export function EmptyState({ children }: { children: string }): ReactNode {
	return (
		<View style={styles.empty}>
			<Text style={styles.emptyText}>{children}</Text>
		</View>
	);
}
