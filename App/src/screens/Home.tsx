import React, {useEffect, useState} from "react";
import {Alert, BackHandler, Button, StyleSheet, View} from "react-native";
import {Menu, MenuOption, MenuOptions, MenuProvider, MenuTrigger} from "react-native-popup-menu";
import Icon from "react-native-vector-icons/MaterialIcons";
import {WebSocketClient, WebSocketClientState} from "../networking/WebSocketClient.ts";
import {PingReq} from "../@types/protobufs-client";
import {AuthTokenManager} from "../networking/authentication/AuthTokenManager.ts";
import {IPingRes, PingRes} from "../@types/protobufs-server";

const Home = () => {
	const [wsState, setWsState] = useState<WebSocketClientState>(WebSocketClient.getInstance().getState());

	useEffect(() => {
		const interval = setInterval(() => {
			setWsState(WebSocketClient.getInstance().getState());
		}, 500);
		return () => clearInterval(interval);
	}, []);

	const connectWs = async () => {
		try {
			const instance = WebSocketClient.getInstance();
			instance.setConnectionFailedCallback(() => {
				Alert.alert("Connection Failed", "Failed to connect to the WebSocket server. Please check your internet connection and try again.");
			});
			instance.setUnauthorizedCallback(() => {
				Alert.alert("Unauthorized", "Your session has expired. Please log in again.");
			});
			await instance.init();
		}
		catch (error) {
			console.error("WebSocket connection failed:", error);
			Alert.alert("Connection Error", "Failed to connect to the WebSocket server. Please try again later.");
		}
	};
	connectWs().then();

	const handlePing = () => {
		WebSocketClient.getInstance().sendPacket(new PingReq({}), {
			[PingRes.name]: (packet: IPingRes) => {
				Alert.alert("Ping Response", `Ping successful! Response time: ${packet.time} ms`);
			}
		});
	};

	const handleLogout = async () => {
		await AuthTokenManager.getInstance().clearToken();
		BackHandler.exitApp();
	};

	const getWsColor = () => {
		return wsState === WebSocketClientState.OPEN ? "#4CAF50" : "#F44336";
	};

	return (
		<MenuProvider>
			<View style={styles.container}>
				<View style={styles.wsIconContainer}>
					<Icon name="circle" size={22} color={getWsColor()} />
				</View>
				<View style={styles.menuContainer}>
					<Menu>
						<MenuTrigger>
							<Icon name="more-vert" size={28} color="#000" />
						</MenuTrigger>
						<MenuOptions>
							<MenuOption onSelect={handleLogout} text="Log out" />
						</MenuOptions>
					</Menu>
				</View>
				<View style={styles.buttonContainer}>
					<Button title="Ping" onPress={handlePing} />
				</View>
			</View>
		</MenuProvider>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
	},
	wsIconContainer: {
		position: 'absolute',
		top: 40,
		left: 20,
		zIndex: 2,
	},
	menuContainer: {
		position: 'absolute',
		top: 40,
		right: 20,
		zIndex: 1,
	},
	buttonContainer: {
		alignItems: 'center',
		justifyContent: 'center',
	},
});

export default Home;
