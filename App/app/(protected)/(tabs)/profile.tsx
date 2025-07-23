import {useRouter} from "expo-router";
import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {Ionicons} from "@expo/vector-icons";

export default function Profile() {
	const router = useRouter();
	return (
		<View style={styles.container}>
			<TouchableOpacity style={styles.button} onPress={() => router.push("/settings")}>
				<Ionicons name="settings" size={24} color="black" style={{ marginRight: 8 }} />
				<Text style={styles.text}>Settings</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		justifyContent: "center",
		marginTop: 25,
	},
	button: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#eee",
		padding: 10,
		borderRadius: 8,
	},
	text: {
		fontSize: 18,
		fontWeight: "bold",
	},
});
