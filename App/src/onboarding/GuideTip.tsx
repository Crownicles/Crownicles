import {ReactNode} from "react";
import {Pressable, Text, View} from "react-native";
import {AppIcons} from "@/src/AppIcons";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {TwemojiText} from "@/src/design/TwemojiText";
import {createStyles} from "@/src/design/ThemeContext";

const GUIDE_EMBLEM = 40;
const GUIDE_ICON = 24;

const useStyles = createStyles(colors => ({
	tip: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Theme.spacing.md,
		marginBottom: Theme.spacing.xl,
		padding: Theme.spacing.lg,
		borderRadius: Theme.radius,
		backgroundColor: colors.goldWash
	},
	emblem: {
		width: GUIDE_EMBLEM,
		height: GUIDE_EMBLEM,
		borderRadius: GUIDE_EMBLEM / 2,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.paper
	},
	body: {flex: 1, gap: Theme.spacing.sm},
	text: {fontFamily: Theme.fonts.regular, fontSize: Theme.fontSize.bodySmall, lineHeight: Theme.lineHeight.bodySmall, color: colors.ink},
	action: {alignSelf: "flex-start", paddingVertical: Theme.spacing.xs},
	actionLabel: {fontFamily: Theme.fonts.semiBold, fontSize: Theme.fontSize.bodySmall, color: colors.gold},
	pressed: {opacity: 0.6}
}));

/** The contest guide stepping in beside what she explains: narrative text, and at most one thing to do. */
export function GuideTip({text, action, testID}: {text: string; action?: {label: string; onPress: () => void}; testID?: string}): ReactNode {
	const styles = useStyles();
	return <View style={styles.tip} {...testID ? {testID} : {}}>
		<View style={styles.emblem}><TwemojiIcon emoji={AppIcons.getIcon("other.guide")} size={GUIDE_ICON} /></View>
		<View style={styles.body}>
			<TwemojiText textStyle={styles.text} emojiSize={Theme.fontSize.bodySmall}>{text}</TwemojiText>
			{action ? <Pressable
				accessibilityRole="button"
				onPress={action.onPress}
				style={({pressed}): object[] => [styles.action, pressed && styles.pressed].filter(Boolean) as object[]}
			>
				<Text style={styles.actionLabel}>{action.label}</Text>
			</Pressable> : null}
		</View>
	</View>;
}
