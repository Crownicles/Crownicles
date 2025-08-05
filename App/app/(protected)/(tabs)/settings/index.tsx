import React, {PropsWithChildren} from "react";
import {ActivityIndicator, Button, ScrollView, StyleSheet, Switch, Text, View} from "react-native";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AuthContext} from "@/src/authentication/AuthContext";
import {PreferencesContext} from "@/src/preferences/PreferencesContext";

const ListItem = ({ children }: PropsWithChildren) => (
  <View style={styles.listItem}>
    {children}
  </View>
);

export default function Index() {
	const preferences = React.useContext(PreferencesContext);
	const authState = React.useContext(AuthContext);
	const [pingLoading, setPingLoading] = React.useState(false);
	const [pingTime, setPingTime] = React.useState<number | null>(null);

	const handlePing = () => {
		setPingLoading(true);
		setPingTime(null);
		const startTime = Date.now();
		WebSocketClient.getInstance().sendPacket(PingReq.create({ time: startTime }), {
			[PingRes.name]: (packet: PingRes) => {
				const elapsed = Date.now() - packet.time;
				setPingTime(elapsed);
				setPingLoading(false);
			},
		});
	};

	return (
		<View style={styles.container}>
			<ScrollView>
				<ListItem>
					<Text>Developer Mode</Text>
					<Switch value={preferences.getDevMode()} onValueChange={preferences.setDevMode} />
				</ListItem>
				{preferences.getDevMode() && (
					<ListItem>
						<Button title="Ping" onPress={handlePing} disabled={pingLoading} />
						{pingLoading ? (
							<ActivityIndicator size="small" style={{ marginLeft: 10 }} />
						) : pingTime !== null ? (
							<Text style={{ marginLeft: 10 }}>{pingTime} ms</Text>
						) : null}
					</ListItem>
				)}
				<ListItem>
					<Button title="Logout" color="red" onPress={() => {
						authState.setState(AuthStateEnum.NO_TOKEN);
						authState.clearToken().then().catch((err) => {
							console.error("Failed to clear token:", err);
						});
					}} />
				</ListItem>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: '#fff',
	},
	header: {
		fontSize: 24,
		fontWeight: 'bold',
		marginBottom: 20,
	},
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 20,
	},
	listItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: 16,
		marginBottom: 8,
		backgroundColor: '#f5f5f5',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#e0e0e0',
	},
});
