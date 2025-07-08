import {StyleSheet, Text, View} from "react-native";

export default function HomeScreen() {
	return (
			<View style={styles.container}>
				<Text>Home</Text>
			</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
});
