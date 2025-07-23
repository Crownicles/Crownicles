import {Tabs} from "expo-router";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";

export default function TabLayout() {
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
			}} />
			<Tabs.Screen name="pet" options={{
				title: "Pet",
				tabBarIcon: ({ color }) => (
						<MaterialCommunityIcons name="paw" size={28} color={color} />
				),
			}} />
			<Tabs.Screen name="settings/index" options={{ href: null, title: "Settings" }} />
		</Tabs>
	)
}