import { AuthTokenManager } from "./authentication/AuthTokenManager.ts";
import Config from "react-native-config";
import { FromClientPacket } from "../@types/protobufs-client";
import { Alert } from "react-native";

export enum WebSocketClientState {
	OPEN = "OPEN",
	AUTH_FAILED = "AUTH_FAILED",
	ERROR = "ERROR"
}

export class WebSocketClient {
	private static instance: WebSocketClient;

	private socket: WebSocket | null = null;

	private unauthorizedCallback: (() => void) | null = null;

	private connectionAttempts = 0;

	private maxConnectionAttempts = 20;

	private connectionFailedCallback: (() => void) | null = null;

	private authFailed = false;

	private packetQueue: FromClientPacket[] = [];

	private constructor() {}

	public static getInstance(): WebSocketClient {
		if (!WebSocketClient.instance) {
			WebSocketClient.instance = new WebSocketClient();
		}
		return WebSocketClient.instance;
	}

	public setUnauthorizedCallback(callback: () => void): void {
		this.unauthorizedCallback = callback;
	}

	public setConnectionFailedCallback(callback: () => void): void {
		this.connectionFailedCallback = callback;
	}

	public async init(): Promise<void> {
		await this.connect();

		setInterval((): void => {
			this.processPacketQueue();
		}, 1000);
	}

	public getState(): WebSocketClientState {
		if (!this.socket) {
			return WebSocketClientState.ERROR;
		}

		if (this.authFailed) {
			return WebSocketClientState.AUTH_FAILED;
		}

		switch (this.socket.readyState) {
			case WebSocket.OPEN:
				return WebSocketClientState.OPEN;
			default:
				return WebSocketClientState.ERROR;
		}
	}

	public sendPacket(packet: FromClientPacket): void {
		this.packetQueue.push(packet);
		this.processPacketQueue();
	}

	private async connect(): Promise<void> {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			return; // Already connected
		}

		const authToken = await AuthTokenManager.getInstance().getToken();
		if (!authToken) {
			throw new Error("No authentication token available.");
		}

		this.socket = new WebSocket(`${Config.WEB_SOCKET_URL}?token=${await authToken.getAccessTokenAndRefreshIfNeeded()}`);

		this.socket.onopen = (): void => {
			console.log("WebSocket connection established.");
			this.connectionAttempts = 0; // Reset connection attempts on successful connection
		};

		this.socket.onmessage = (event): void => {
			// todo
			console.log("Message received:", event.data);
			Alert.alert("Message received", event.data);
		};

		this.socket.onerror = (error): void => {
			console.error("WebSocket error:", error);
			this.socket?.close();
		};

		this.socket.onclose = (error): void => {
			console.log("WebSocket connection closed.");
			if (error.reason === "Unauthorized") {
				this.authFailed = true;
				if (this.unauthorizedCallback) {
					this.unauthorizedCallback();
				}
				console.error("WebSocket authentication failed.");
			}
			else {
				this.authFailed = false;
			}
			const instance = WebSocketClient.getInstance();
			instance.socket = null; // Reset socket on close
			if (instance.connectionAttempts >= instance.maxConnectionAttempts) {
				console.error("Max connection attempts reached. Stopping reconnection attempts.");
				instance.connectionAttempts = 0; // Reset attempts
				instance.socket = null; // Clear socket
				instance.authFailed = false; // Reset auth failed state
				instance.packetQueue = []; // Clear packet queue
				if (instance.connectionFailedCallback) {
					instance.connectionFailedCallback();
				}
				return;
			}
			setTimeout(function() {
				console.log("Attempting to reconnect WebSocket...");
				instance.connectionAttempts++;
				instance.connect.bind(instance)(); // Attempt to reconnect after 1 second
			}, 1000);
		};
	}

	private processPacketQueue(): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			while (this.packetQueue.length > 0) {
				const packet = this.packetQueue.shift();
				if (packet) {
					this.socket.send(JSON.stringify({
						name: packet.constructor.name,
						data: packet
					}));
				}
			}
		}
		else {
			console.warn("WebSocket is not open. Queueing packets.");
		}
	}
}
