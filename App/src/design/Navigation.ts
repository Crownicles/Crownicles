import {ComponentProps} from "react";
import {StyleSheet} from "react-native";
import type {TopTabs} from "expo-router/js-top-tabs";
import {Theme} from "@/src/design/Theme";

/** Expo SDK 57 ships its own copy of the navigators, so the options type is read back off the component. */
type TopTabOptions = Exclude<ComponentProps<typeof TopTabs>["screenOptions"], undefined | ((...args: never[]) => unknown)>;

export const tabBarOptions = {
	tabBarActiveTintColor: Theme.colors.ink,
	tabBarInactiveTintColor: Theme.colors.muted,
	tabBarShowIcon: true,
	/** The bar carries the selection through colour alone, as the bottom bar always did. */
	tabBarIndicatorStyle: {
		height: 0
	},
	tabBarPressColor: "transparent",
	tabBarStyle: {
		borderTopWidth: 1,
		borderTopColor: Theme.colors.line,
		backgroundColor: Theme.colors.paper,
		paddingTop: Theme.spacing.tabBarVertical,
		paddingHorizontal: Theme.spacing.tabBarHorizontal,
		elevation: 0,
		shadowOpacity: 0
	},
	tabBarItemStyle: {
		paddingVertical: 0
	},
	tabBarLabelStyle: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.tabLabel,
		lineHeight: Theme.lineHeight.tabLabel,
		textTransform: "none" as const
	}
} satisfies Pick<
	TopTabOptions,
	"tabBarActiveTintColor" | "tabBarInactiveTintColor" | "tabBarShowIcon" | "tabBarIndicatorStyle" | "tabBarPressColor" | "tabBarStyle" | "tabBarItemStyle" | "tabBarLabelStyle"
>;

export const navigationStyles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Theme.spacing.lg,
		paddingBottom: Theme.spacing.md,
		backgroundColor: Theme.colors.paper,
		borderBottomWidth: 1,
		borderBottomColor: Theme.colors.line
	},
	/** Balances the settings button so the identity stays centred. */
	headerSpacer: {
		width: Theme.dimensions.headerIcon
	},
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