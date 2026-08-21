import React, {PropsWithChildren} from "react";
import {ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View} from "react-native";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AuthContext} from "@/src/authentication/AuthContext";
import {PreferencesContext} from "@/src/preferences/PreferencesContext";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PingReq} from "ws-packets/src/fromClient/PingReq";
import {PingRes} from "ws-packets/src/fromServer/ping/PingRes";
import {Theme} from "@/src/design/Theme";
import {Button as DesignButton} from "@/src/design/Primitives";

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: Theme.spacing.xl,
		backgroundColor: Theme.colors.wash,
	},
	header: {
		fontFamily: Theme.fonts.bold,
		fontSize: Theme.fontSize.hero,
		marginBottom: Theme.spacing.xl,
	},
	item: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: Theme.spacing.xl,
	},
	listItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: Theme.spacing.lg,
		marginBottom: Theme.spacing.sm,
		backgroundColor: Theme.colors.paper,
		borderRadius: Theme.radius,
		borderWidth: 1,
		borderColor: Theme.colors.line,
	},
	loadingIndicator: {
		marginLeft: Theme.spacing.sm
	},
	pingValue: {
		marginLeft: Theme.spacing.sm,
		fontFamily: Theme.fonts.regular,
		color: Theme.colors.muted
	},
	label: {
		fontFamily: Theme.fonts.regular,
		fontSize: Theme.fontSize.body,
		color: Theme.colors.ink
	},
});

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
		WebSocketClient.getInstance().sendPacket(makeFromClientPacket(PingReq, { time: startTime }), {
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
					<Text style={styles.label}>Developer Mode</Text>
					<Switch value={preferences.getDevMode()} onValueChange={preferences.setDevMode} />
				</ListItem>
				{preferences.getDevMode() && (
					<ListItem>
							<DesignButton onPress={handlePing} disabled={pingLoading} variant="primary">Ping</DesignButton>
						{pingLoading ? (
							<ActivityIndicator size="small" style={styles.loadingIndicator} />
						) : pingTime !== null ? (
							<Text style={styles.pingValue}>{pingTime} ms</Text>
						) : null}
					</ListItem>
				)}
				<ListItem>
					<DesignButton variant="danger" onPress={() => {
						authState.setState(AuthStateEnum.NO_TOKEN);
						authState.clearToken().then().catch((err) => {
							console.error("Failed to clear token:", err);
						});
					}}>Logout</DesignButton>
				</ListItem>
			</ScrollView>
		</View>
	);
}
