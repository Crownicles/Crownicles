import {ReactElement} from "react";
import {StyleSheet, Text, View} from "react-native";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {CircleAlert} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {createStyles, useColors} from "@/src/design/ThemeContext";
import {i18n} from "@/src/translations/i18n";

const useStyles = createStyles(colors => ({
	banner: {
		backgroundColor: colors.redWash,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.red
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Theme.spacing.sm,
		paddingHorizontal: Theme.spacing.md,
		paddingVertical: Theme.spacing.md
	},
	label: {
		fontFamily: Theme.fonts.medium,
		fontSize: Theme.fontSize.body,
		lineHeight: Theme.lineHeight.body,
		color: colors.ink,
		flexShrink: 1
	}
}));

export function ConnectionStatus({state, topInset}: {state: AuthStateEnum; topInset: number}): ReactElement | null {
	const styles = useStyles();
	const colors = useColors();
	if (state !== AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE && state !== AuthStateEnum.RECONNECTING_PACKET_QUEUE) {
		return null;
	}
	return <View style={[styles.banner, {paddingTop: topInset}]}>
		<View style={styles.row}>
			<CircleAlert size={Theme.dimensions.headerIcon} color={colors.red} />
			<Text accessibilityLiveRegion="polite" style={styles.label}>
				{i18n.t("app:common.reconnecting")}
			</Text>
		</View>
	</View>;
}