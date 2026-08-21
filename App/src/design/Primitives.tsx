import {Children, Fragment, ReactNode, isValidElement} from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
	type StyleProp,
	type ViewStyle
} from "react-native";
import {Theme} from "@/src/design/Theme";
import {TwemojiText} from "@/src/design/TwemojiText";

const styles = StyleSheet.create({
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
	panel: {
		borderWidth: 1, borderColor: Theme.colors.line, borderRadius: Theme.radius, overflow: "hidden", backgroundColor: Theme.colors.paper
	},
	separator: {
		height: 1, backgroundColor: Theme.colors.line
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.md,
		width: "100%",
		paddingVertical: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.lg,
		backgroundColor: Theme.colors.paper
	},
	rowPressed: {
		backgroundColor: Theme.colors.wash
	},
	rowDisabled: {
		opacity: 0.5
	},
	rowIcon: {
		width: 24,
		alignItems: "center",
		justifyContent: "center"
	},
	rowBody: {
		flex: 1,
		minWidth: 0
	},
	rowTitle: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.medium,
		fontSize: Theme.fontSize.rowTitle,
		flexShrink: 1
	},
	rowSubtitle: {
		color: Theme.colors.muted,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.rowSubtitle,
		lineHeight: Theme.lineHeight.rowSubtitle,
		flexShrink: 1
	},
	rowEnd: {
		maxWidth: "40%",
		color: Theme.colors.muted,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.caption,
		textAlign: "right",
		flexShrink: 1
	},
	rowChevron: {
		color: Theme.colors.faint,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.chevron
	},
	rowDanger: {
		color: Theme.colors.red
	},
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
	},
	buttonRow: {
		flexDirection: "row",
		flexWrap: "wrap",
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
	buttonPrimaryText: {
		color: Theme.colors.paper
	},
	buttonDangerText: {
		color: Theme.colors.red
	},
	notice: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.noticeGap,
		marginVertical: 14,
		paddingVertical: Theme.spacing.md,
		paddingHorizontal: Theme.spacing.lg,
		borderRadius: Theme.radius,
		backgroundColor: Theme.colors.wash
	},
	noticeIcon: {
		width: 24,
		alignItems: "center"
	},
	noticeBody: {
		flex: 1,
		minWidth: 0
	},
	noticeTitle: {
		color: Theme.colors.ink,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body
	},
	noticeText: {
		color: Theme.colors.muted,
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.bodySmall,
		lineHeight: Theme.lineHeight.bodySmall
	},
	noticeAction: {
		paddingLeft: Theme.spacing.sm
	},
	noticeActionText: {
		color: Theme.colors.blue,
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.bodySmall
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

function getPanelChildKey(child: ReactNode): string {
	if (isValidElement(child) && child.key !== null) {
		return child.key.toString();
	}
	return String(child);
}

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

export function Hero({ eyebrow, title, subtitle }: {
	eyebrow: string; title: string; subtitle?: string;
}): ReactNode {
	return (
		<View style={styles.hero}>
			<Text style={styles.eyebrow}>{eyebrow}</Text>
			<TwemojiText
				containerStyle={styles.heroTitle}
				textStyle={styles.heroTitleText}
				emojiSize={Theme.fontSize.hero}
			>
				{title}
			</TwemojiText>
			{subtitle ? <TwemojiText textStyle={styles.heroSubtitle} emojiSize={Theme.fontSize.body}>{subtitle}</TwemojiText> : null}
		</View>
	);
}

export function SectionHeader({ children, action, first = false }: {
	children: string;
	action?: { label?: string; hint?: string; onPress?: () => void };
	first?: boolean;
}): ReactNode {
	return (
		<View style={[styles.sectionHead, first && styles.sectionHeadFirst]}>
			<Text style={styles.sectionHeader}>{children}</Text>
			{action?.hint ? <Text style={styles.sectionHint}>{action.hint}</Text> : null}
			{action?.label && action.onPress ? (
				<Pressable accessibilityRole="button" onPress={action.onPress} style={styles.sectionAction}>
					<Text style={styles.sectionActionText}>{action.label}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

/**
 * Separators are drawn by the panel rather than by its children, so the first row never carries a
 * line that would double the border of the card.
 * @param children
 */
export function Panel({ children }: { children: ReactNode }): ReactNode {
	return (
		<View style={styles.panel}>
			{Children.toArray(children).map((child, index) => (
				<Fragment key={getPanelChildKey(child)}>
					{index > 0 ? <View style={styles.separator} /> : null}
					{child}
				</Fragment>
			))}
		</View>
	);
}

export function Row({ icon, title, subtitle, end, chevron = false, tone, disabled = false, onPress }: {
	icon?: ReactNode;
	title: string;
	subtitle?: string;
	end?: ReactNode;
	chevron?: boolean;
	tone?: "danger";
	disabled?: boolean;
	onPress?: () => void;
}): ReactNode {
	const content = (
		<>
			{icon ? <View style={styles.rowIcon}>{icon}</View> : null}
			<View style={styles.rowBody}>
				<Text style={[styles.rowTitle, tone === "danger" && styles.rowDanger]}>{title}</Text>
				{subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
			</View>
			{end ? <Text style={styles.rowEnd}>{end}</Text> : null}
			{chevron ? <Text style={styles.rowChevron}>›</Text> : null}
		</>
	);

	if (!onPress) {
		return <View style={[styles.row, disabled && styles.rowDisabled]}>{content}</View>;
	}

	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({pressed}) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}
		>
			{content}
		</Pressable>
	);
}

export function KeyValue({ label, value }: { label: string; value: string }): ReactNode {
	return (
		<View style={styles.keyValue}>
			<TwemojiText containerStyle={styles.keyValueLabelContainer} textStyle={styles.keyValueLabel} emojiSize={Theme.fontSize.body}>
				{label}
			</TwemojiText>
			<TwemojiText containerStyle={styles.keyValueValueContainer} textStyle={styles.keyValueValue} emojiSize={Theme.fontSize.body}>
				{value}
			</TwemojiText>
		</View>
	);
}

export function StatBar({ label, value, ratio, color }: {
	label: string; value: string; ratio: number; color: string;
}): ReactNode {
	return (
		<View style={styles.stat}>
			<View style={styles.statHead}>
				<TwemojiText textStyle={styles.keyValueLabel} emojiSize={Theme.fontSize.body}>{label}</TwemojiText>
				<TwemojiText containerStyle={styles.keyValueValueContainer} textStyle={styles.keyValueValue} emojiSize={Theme.fontSize.body}>{value}</TwemojiText>
			</View>
			<View style={styles.track}>
				<View style={[styles.fill, {
					width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: color
				}]} />
			</View>
		</View>
	);
}

export function Note({ children }: { children: string }): ReactNode {
	return <TwemojiText containerStyle={styles.note} textStyle={styles.noteText} emojiSize={Theme.fontSize.note}>{children}</TwemojiText>;
}

export function Button({ children, onPress, variant = "secondary", disabled = false }: {
	children: string;
	onPress?: () => void;
	variant?: "secondary" | "primary" | "danger";
	disabled?: boolean;
}): ReactNode {
	const button = (
		<Text style={[styles.buttonText, variant === "primary" && styles.buttonPrimaryText, variant === "danger" && styles.buttonDangerText]}>
			{children}
		</Text>
	);

	if (!onPress) {
		return <View style={[styles.button, variant === "primary" && styles.buttonPrimary, variant === "danger" && styles.buttonDanger, disabled && styles.rowDisabled]}>{button}</View>;
	}

	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({pressed}) => [
				styles.button,
				variant === "primary" && styles.buttonPrimary,
				variant === "danger" && styles.buttonDanger,
				pressed && styles.buttonPressed,
				disabled && styles.rowDisabled
			]}
		>
			{button}
		</Pressable>
	);
}

export function ButtonRow({ children }: { children: ReactNode }): ReactNode {
	return <View style={styles.buttonRow}>{children}</View>;
}

export function Notice({ icon, title, text, action }: {
	icon?: ReactNode;
	title: string;
	text?: string;
	action?: { label: string; onPress: () => void };
}): ReactNode {
	return (
		<View style={styles.notice}>
			{icon ? <View style={styles.noticeIcon}>{icon}</View> : null}
			<View style={styles.noticeBody}>
				<Text style={styles.noticeTitle}>{title}</Text>
				{text ? <Text style={styles.noticeText}>{text}</Text> : null}
			</View>
			{action ? (
				<Pressable accessibilityRole="button" onPress={action.onPress} style={styles.noticeAction}>
					<Text style={styles.noticeActionText}>{action.label}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

export function EmptyState({ children }: { children: string }): ReactNode {
	return (
		<View style={styles.empty}>
			<Text style={styles.emptyText}>{children}</Text>
		</View>
	);
}
