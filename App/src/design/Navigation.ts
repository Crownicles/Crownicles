import {ComponentProps} from "react";
import type {TopTabs} from "expo-router/js-top-tabs";
import {Palette, Theme} from "@/src/design/Theme";
import {createStyles} from "@/src/design/ThemeContext";

/** Expo SDK 57 ships its own copy of the navigators, so the options type is read back off the component. */
type TopTabOptions = Exclude<ComponentProps<typeof TopTabs>["screenOptions"], undefined | ((...args: never[]) => unknown)>;

type TabBarOptionKeys = "tabBarActiveTintColor" | "tabBarInactiveTintColor" | "tabBarShowIcon" | "tabBarPressColor" | "tabBarStyle" | "tabBarItemStyle" | "tabBarLabelStyle";

export function tabBarOptionsOf(colors: Palette) {
	return {
		tabBarActiveTintColor: colors.selectionInk,
		tabBarInactiveTintColor: colors.muted,
		tabBarShowIcon: true,
		tabBarPressColor: "transparent",
		tabBarStyle: {
			borderTopWidth: 1,
			borderTopColor: colors.line,
			backgroundColor: colors.paper,
			paddingTop: Theme.spacing.tabBarVertical,
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
	} satisfies Pick<TopTabOptions, TabBarOptionKeys>;
}

export const useNavigationStyles = createStyles(colors => ({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Theme.spacing.lg,
		paddingBottom: Theme.spacing.md,
		backgroundColor: colors.paper,
		borderBottomWidth: 1,
		borderBottomColor: colors.line
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
		marginRight: Theme.spacing.sm
	},
	profileIdentity: {
		alignItems: "center"
	},
	profileName: {
		fontFamily: Theme.fonts.semiBold,
		fontSize: Theme.fontSize.title,
		color: colors.ink,
		textAlign: "center"
	},
	profileLevel: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.caption,
		color: colors.muted,
		textAlign: "center"
	},
	settingsButton: {
		marginRight: Theme.spacing.lg
	}
}));