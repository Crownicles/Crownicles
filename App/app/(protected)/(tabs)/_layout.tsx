import {Tabs, useRouter} from "expo-router";
import {Ionicons, MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {Alert, Text, TouchableOpacity, View} from "react-native";
import {useContext} from "react";
import {AuthContext} from "@/src/authentication/AuthContext";
import {GameQueryProvider} from "@/src/store/GameQueryProvider";
import {CollectorsProvider} from "@/src/collectors/CollectorsContext";
import {OpenCollectors} from "@/src/collectors/OpenCollectors";
import {AppIcons} from "@/src/AppIcons";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";
import {i18n} from "@/src/translations/i18n";

const ProfileHeader = ({ children }: { children?: string }) => {
	/*
	 * Reads the profile from the store rather than waiting for the profile screen to fill it in:
	 * the header is shown before that screen is ever opened, and both share this single request.
	 */
	const state = usePlayerProfile();
	const profile = state.status === "ready" ? state.data : null;

	const showClassInfo = () => {
		Alert.alert("Class Info", "This feature will be implemented later!");
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
			style={{ flexDirection: 'row', alignItems: 'center' }}
		>
			<Text style={{ fontSize: 25, marginRight: 8 }}>
				{getClassIcon()}
			</Text>
			<View style={{ flexDirection: 'column', alignItems: 'center' }}>
				<Text style={{ fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
					{children || profile?.pseudo}
				</Text>
				{profile && (
					<Text style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
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
		<Tabs>
			<Tabs.Screen name="arena" options={{
				title: i18n.t("app:tabs.arena"),
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="shield-sword" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="guild" options={{
				title: i18n.t("app:tabs.guild"),
				tabBarIcon: ({ color }) => (
						<MaterialIcons name="stadium" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="index" options={{
				title: i18n.t("app:tabs.adventure"),
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="book-open-page-variant" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="profile" options={{
				title: i18n.t("app:tabs.profile"),
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="account" size={28} color={color} />
				),
				headerTitle: ProfileHeader,
				headerRight: () => (
					<TouchableOpacity
						style={{ marginRight: 15 }}
						onPress={() => router.push("/settings")}
					>
						<Ionicons name="settings" size={24} color="gray" />
					</TouchableOpacity>
				),
			}} />
			<Tabs.Screen name="pet" options={{
				title: i18n.t("app:tabs.pet"),
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="paw" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="settings/index" options={{ href: null, title: "Settings" }} />
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