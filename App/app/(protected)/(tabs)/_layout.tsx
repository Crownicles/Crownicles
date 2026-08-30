import {Tabs, useRouter} from "expo-router";
import {Alert, Text, TouchableOpacity, View} from "react-native";
import {useContext} from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {GameQueryProvider} from "@/src/store/GameQueryProvider";
import {CollectorsProvider} from "@/src/collectors/CollectorsContext";
import {OpenCollectors} from "@/src/collectors/OpenCollectors";
import {AppIcons} from "@/src/AppIcons";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";
import {navigationStyles, tabBarOptions} from "@/src/design/Navigation";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";

const ProfileHeader = ({ children }: { children?: string }) => {
	/*
	 * Reads the profile from the store rather than waiting for the profile screen to fill it in:
	 * the header is shown before that screen is ever opened, and both share this single request.
	 */
	const state = usePlayerProfile();
	const profile = state.status === "ready" ? state.data : null;

	const showClassInfo = () => {
		Alert.alert(i18n.t("app:navigation.classInfo"), i18n.t("app:navigation.featureNotAvailable"));
	};

	const getClassIcon = () => {
		if (profile) {
			const icon = AppIcons.getIconOrNull(`classes.${profile.classId}`);
			if (icon) {
				return icon;
			}
		}
		return "";
	};

	return (
		<TouchableOpacity
			onPress={showClassInfo}
			style={navigationStyles.profileHeader}
		>
			<Text style={navigationStyles.profileClassIcon}>
				{getClassIcon()}
			</Text>
			<View style={navigationStyles.profileIdentity}>
				<Text style={navigationStyles.profileName}>
					{children || profile?.pseudo}
				</Text>
				{profile && (
					<Text style={navigationStyles.profileLevel}>
						{i18n.t("app:profile.level", { level: profile.level })}
					</Text>
				)}
			</View>
		</TouchableOpacity>
	);
};

function TabLayoutContent() {
	const router = useRouter();

	return (
		<Tabs screenOptions={tabBarOptions}>
			<Tabs.Screen name="index" options={{
				title: i18n.t("app:tabs.adventure"),
				tabBarIcon: ({ focused }) => (
					<TwemojiIcon emoji={AppIcons.getIcon("navigation.adventure")} size={Theme.dimensions.tabBarIcon} opacity={focused ? 1 : 0.55} />
				),
			}} />
			<Tabs.Screen name="profile" options={{
				title: i18n.t("app:tabs.profile"),
				tabBarIcon: ({ focused }) => (
					<TwemojiIcon emoji={AppIcons.getIcon("navigation.profile")} size={Theme.dimensions.tabBarIcon} opacity={focused ? 1 : 0.55} />
				),
				headerTitle: ProfileHeader,
				headerRight: () => (
					<TouchableOpacity
						style={navigationStyles.settingsButton}
						onPress={() => router.push("/settings")}
					>
						<Text style={navigationStyles.settingsIcon}>{AppIcons.getIcon("other.gear")}</Text>
					</TouchableOpacity>
				),
			}} />
			<Tabs.Screen name="pet" options={{
				title: i18n.t("app:tabs.pet"),
				tabBarIcon: ({ focused }) => (
					<TwemojiIcon emoji={AppIcons.getIcon("navigation.pet")} size={Theme.dimensions.tabBarIcon} opacity={focused ? 1 : 0.55} />
				),
			}} />
			<Tabs.Screen name="guild" options={{
				title: i18n.t("app:tabs.guild"),
				tabBarIcon: ({ focused }) => (
					<TwemojiIcon emoji={AppIcons.getIcon("navigation.guild")} size={Theme.dimensions.tabBarIcon} opacity={focused ? 1 : 0.55} />
				),
			}} />
			<Tabs.Screen name="arena" options={{
				title: i18n.t("app:tabs.arena"),
				tabBarIcon: ({ focused }) => (
					<TwemojiIcon emoji={AppIcons.getIcon("navigation.fight")} size={Theme.dimensions.tabBarIcon} opacity={focused ? 1 : 0.55} />
				),
			}} />
			<Tabs.Screen name="settings/index" options={{ href: null, title: i18n.t("app:settings.title") }} />
		</Tabs>
	);
}

export default function TabLayout() {
	const {state: authState} = useContext(AuthContext);

	return (
		<GameQueryProvider authState={authState}>
			<CollectorsProvider>
				<TabLayoutContent />
				<OpenCollectors />
			</CollectorsProvider>
		</GameQueryProvider>
	);
}
