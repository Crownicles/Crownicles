import {ReactElement} from "react";
import {StyleSheet, Text, View} from "react-native";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {Check, CircleAlert} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {createStyles, useColors} from "@/src/design/ThemeContext";
import {i18n} from "@/src/translations/i18n";

const useStyles = createStyles(colors => ({
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Theme.spacing.xs,
		paddingHorizontal: Theme.spacing.md,
		paddingTop: Theme.spacing.xs,
		backgroundColor: colors.paper,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.line
	},
	label: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		lineHeight: Theme.lineHeight.note,
		color: colors.muted,
		flexShrink: 1
	}
}));

export function ConnectionStatus({state, bottomInset}: {state: AuthStateEnum; bottomInset: number}): ReactElement {
	const styles = useStyles();
	const colors = useColors();
	const connected = state === AuthStateEnum.LOGGED_IN;
	const Icon = connected ? Check : CircleAlert;
	return <View style={[styles.row, {paddingBottom: Math.max(bottomInset, Theme.spacing.xs)}]}>
		<Icon size={Theme.fontSize.body} color={connected ? colors.green : colors.red} />
		<Text accessibilityLiveRegion="polite" style={styles.label}>
			{i18n.t(connected ? "app:common.connected" : "app:common.reconnecting")}
		</Text>
	</View>;
}