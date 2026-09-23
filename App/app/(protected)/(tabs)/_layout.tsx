import {ReactElement, ReactNode} from "react";
import {useRouter} from "expo-router";
/** Expo SDK 57 no longer accepts react-navigation directly, so the top tabs come from its own copy. */
import {TopTabs} from "expo-router/js-top-tabs";
import {Alert, Text, TouchableOpacity, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppIcons} from "@/src/AppIcons";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {navigationStyles, tabBarOptions} from "@/src/design/Navigation";
import {SwipeBackBoundary, useSwipeBackOpen} from "@/src/design/SwipeBack";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const screenStyles = {flex: 1, backgroundColor: Theme.colors.paper};

function tabIcon(path: string): (props: {focused: boolean}) => ReactElement {
	const Icon = ({focused}: {focused: boolean}): ReactElement => <TwemojiIcon emoji={AppIcons.getIcon(path)} size={Theme.dimensions.tabBarIcon} opacity={focused ? 1 : 0.55} />;
	Icon.displayName = `TabIcon(${path})`;
	return Icon;
}

const ProfileHeader = (): ReactNode => {
	/*
	 * Reads the profile from the store rather than waiting for the profile screen to fill it in:
	 * the header is shown before that screen is ever opened, and both share this single request.
	 */
	const state = usePlayerProfile();
	const profile = state.status === "ready" ? state.data : null;
	const showClassInfo = (): void => {
		Alert.alert(i18n.t("app:navigation.classInfo"), i18n.t("app:navigation.featureNotAvailable"));
	};
	const classIcon = profile ? AppIcons.getIconOrNull(`classes.${profile.classId}`) : null;
	return (
		<TouchableOpacity onPress={showClassInfo} style={navigationStyles.profileHeader}>
			{classIcon ? <View style={navigationStyles.profileClassIcon}><TwemojiIcon emoji={classIcon} size={Theme.fontSize.hero} /></View> : null}
			<View style={navigationStyles.profileIdentity}>
				<Text style={navigationStyles.profileName}>{profile?.pseudo}</Text>
				{profile ? <Text style={navigationStyles.profileLevel}>{i18n.t("app:profile.level", {level: profile.level})}</Text> : null}
			</View>
		</TouchableOpacity>
	);
};

function TabsHeader(): ReactNode {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	return (
		<View style={[navigationStyles.header, {paddingTop: insets.top}]}>
			<View style={navigationStyles.headerSpacer} />
			<ProfileHeader />
			<TouchableOpacity style={navigationStyles.settingsButton} onPress={(): void => router.push("/settings")}>
				<TwemojiIcon emoji={AppIcons.getIcon("other.gear")} size={Theme.dimensions.headerIcon} />
			</TouchableOpacity>
		</View>
	);
}

function TabPager(): ReactNode {
	const insets = useSafeAreaInsets();
	const detailOpen = useSwipeBackOpen();
	return (
		<TopTabs
			tabBarPosition="bottom"
			screenOptions={{
				...tabBarOptions,
				swipeEnabled: !detailOpen,
				tabBarStyle: {...tabBarOptions.tabBarStyle, paddingBottom: insets.bottom + Theme.spacing.tabBarVertical}
			}}
		>
			<TopTabs.Screen name="index" options={{title: i18n.t("app:tabs.adventure"), tabBarIcon: tabIcon("navigation.adventure")}} />
			<TopTabs.Screen name="profile" options={{title: i18n.t("app:tabs.profile"), tabBarIcon: tabIcon("navigation.profile")}} />
			<TopTabs.Screen name="pet" options={{title: i18n.t("app:tabs.pet"), tabBarIcon: tabIcon("navigation.pet")}} />
			<TopTabs.Screen name="guild" options={{title: i18n.t("app:tabs.guild"), tabBarIcon: tabIcon("navigation.guild")}} />
			<TopTabs.Screen name="arena" options={{title: i18n.t("app:tabs.arena"), tabBarIcon: tabIcon("navigation.fight")}} />
		</TopTabs>
	);
}

export default function TabLayout(): ReactNode {
	return (
		<View style={screenStyles}>
			<TabsHeader />
			<SwipeBackBoundary><TabPager /></SwipeBackBoundary>
		</View>
	);
}
