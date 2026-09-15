import {StyleSheet} from "react-native";
import type {BottomTabNavigationOptions} from "@react-navigation/bottom-tabs";
import {Theme} from "@/src/design/Theme";

export const tabBarOptions = {
	tabBarActiveTintColor: Theme.colors.ink,
	tabBarInactiveTintColor: Theme.colors.muted,
	tabBarStyle: {
		borderTopWidth: 1,
		borderTopColor: Theme.colors.line,
		backgroundColor: Theme.colors.paper,
		paddingTop: Theme.spacing.tabBarVertical,
		paddingBottom: Theme.spacing.tabBarVertical,
		paddingHorizontal: Theme.spacing.tabBarHorizontal
	},
	tabBarItemStyle: {
		paddingVertical: 0
	},
	tabBarLabelStyle: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.tabLabel,
		lineHeight: Theme.lineHeight.tabLabel
	}
} satisfies Pick<
	BottomTabNavigationOptions,
	"tabBarActiveTintColor" | "tabBarInactiveTintColor" | "tabBarStyle" | "tabBarItemStyle" | "tabBarLabelStyle"
>;

export const navigationStyles = StyleSheet.create({
	tabIcon: {
		fontSize: Theme.dimensions.tabBarIcon,
		lineHeight: Theme.dimensions.tabBarIcon,
		textAlign: "center"
	},
	tabIconInactive: {
		opacity: 0.55
	},
	profileHeader: {
		flexDirection: "row",
		alignItems: "center"
	},
	profileClassIcon: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.hero,
		marginRight: Theme.spacing.sm
	},
	profileIdentity: {
		alignItems: "center"
	},
	profileName: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.title,
		textAlign: "center"
	},
	profileLevel: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		color: Theme.colors.muted,
		textAlign: "center"
	},
	settingsButton: {
		marginRight: Theme.spacing.lg
	},
	settingsIcon: {
		fontSize: Theme.dimensions.headerIcon,
		lineHeight: Theme.dimensions.headerIcon,
		textAlign: "center"
	}
});