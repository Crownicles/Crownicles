import {Tabs, useRouter} from "expo-router";
import {Ionicons, MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {Alert, Text, TouchableOpacity, View} from "react-native";
import {ProfileProvider, useProfile} from "@/src/contexts/ProfileContext";
import {AppIcons} from "@/src/AppIcons";

const ProfileHeader = ({ children }: { children?: string }) => {
	const { profileData } = useProfile();

	const showClassInfo = () => {
		Alert.alert("Class Info", "This feature will be implemented later!");
	};

	const getClassIcon = () => {
		if (profileData.classId !== undefined) {
			const icon = AppIcons.getIconOrNull(`classes.${profileData.classId}`);
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
					{children || profileData.pseudo}
				</Text>
				{profileData.level !== undefined && (
					<Text style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
						Level {profileData.level}
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
				title: "Arena",
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="shield-sword" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="guild" options={{
				title: "Guild",
				tabBarIcon: ({ color }) => (
						<MaterialIcons name="stadium" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="index" options={{
				title: "Adventure",
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="book-open-page-variant" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="profile" options={{
				title: "Profile",
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="account" size={28} color={color} />
				),
				headerTitle: ProfileHeader,
				headerRight: () => (
					<>
						<TouchableOpacity
							style={{ marginRight: 20 }}
							onPress={() => router.push("/friends")}
						>
							<Ionicons name="people" size={24} color="blue" />
						</TouchableOpacity>
						<TouchableOpacity
							style={{ marginRight: 15 }}
							onPress={() => router.push("/settings")}
						>
							<Ionicons name="settings" size={24} color="gray" />
						</TouchableOpacity>
					</>
				),
			}} />
			<Tabs.Screen name="pet" options={{
				title: "Pet",
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="paw" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="settings/index" options={{ href: null, title: "Settings" }} />
		</Tabs>
	);
}

export default function TabLayout() {
	return (
		<ProfileProvider>
			<TabLayoutContent />
		</ProfileProvider>
	);
}