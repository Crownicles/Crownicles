import {FromClientPacket} from "../@types/protobufs-client";
import {FromServerPacket} from "../@types/protobufs-server";
import uuid from "react-native-uuid";
import {AuthStateEnum} from "@/src/authentication/AuthContext";
import {AuthToken} from "@/src/authentication/AuthToken";

export type WebSocketPacketResponseHandler<T extends FromServerPacket> = (packet: T) => void;

export class WebSocketClient {
	private static instance: WebSocketClient;

	private socket: WebSocket | null = null;

	private connectionAttempts = 0;

	private maxConnectionAttempts = 20;

	private packetQueue: {
		id?: string; packet: FromClientPacket;
	}[] = [];

	private responseHandlers: {
		[packetId: string]: {
			[packetName: string]: {
				cleanTime: Date;
				callback: WebSocketPacketResponseHandler<never>;
			};
		};
	} = {};

	private globalPacketHandlers: {
		[packetName: string]: WebSocketPacketResponseHandler<never>;
	} = {};

	private setState: (newState: AuthStateEnum) => void = () => {};

	private saveToken: (token: AuthToken) => Promise<void> = async () => {};

	private constructor() {}

	public static getInstance(): WebSocketClient {
		if (!WebSocketClient.instance) {
			WebSocketClient.instance = new WebSocketClient();
		}
		return WebSocketClient.instance;
	}

	public setGlobalPacketHandler(packetName: string, callback: WebSocketPacketResponseHandler<never>): void {
		this.globalPacketHandlers[packetName] = callback;
	}

	public async init(authToken: AuthToken, setState: (newState: AuthStateEnum) => void, saveToken: (token: AuthToken) => Promise<void>): Promise<void> {
		this.setState = setState;
		this.saveToken = saveToken;

		await this.connect(authToken);

		setInterval((): void => {
			this.processPacketQueue();
		}, 1000);

		setInterval((): void => {
			this.cleanResponseHandlers();
		}, 60 * 1000); // Clean response handlers every minute
	}

	public sendPacket(packet: FromClientPacket, responseHandlers: {
		[packetName: string]: WebSocketPacketResponseHandler<never>;
	}): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			console.warn("WebSocket is not open. Packet will be queued.");
			this.packetQueue.push({ packet });
			this.setState(AuthStateEnum.RECONNECTING_PACKET_QUEUE);
			return;
		}
		if (Object.keys(responseHandlers).length > 0) {
			const packetId = uuid.v4(); // Generate a unique ID for the packet
			this.responseHandlers[packetId] = {};
			for (const [packetName, callback] of Object.entries(responseHandlers)) {
				this.responseHandlers[packetId][packetName] = {
					cleanTime: new Date(Date.now() + 10 * 60 * 60 * 1000), // Set a timeout of 10 minutes
					callback
				};
			}

			this.packetQueue.push({
				packet, id: packetId
			});
		}
		else {
			this.packetQueue.push({ packet });
		}
		this.processPacketQueue();
	}

	private async connect(authToken: AuthToken): Promise<void> {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.setState(AuthStateEnum.LOGGED_IN);
			return; // Already connected
		}

		const webSocketUrl = process.env.EXPO_PUBLIC_WEBSOCKET_URL;
		if (!webSocketUrl) {
			throw new Error("WebSocket URL is not defined in environment variables.");
		}

		if (await authToken.refreshIfNeeded()) {
			console.debug("Token refreshed successfully:", authToken);
			await this.saveToken(authToken); // Save the refreshed token
		}

		let accessToken = authToken.getAccessToken();
		if (!accessToken) {
			console.error("No access token available for WebSocket connection.");
			this.setState(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED);
			return;
		}

		this.socket = new WebSocket(`${webSocketUrl}?token=${accessToken}`);
		this.setState(AuthStateEnum.CONNECTING);

		this.socket.onopen = (): void => {
			console.log("WebSocket connection established.");
			this.connectionAttempts = 0; // Reset connection attempts on successful connection
			this.setState(AuthStateEnum.LOGGED_IN);
		};

		this.socket.onmessage = (event): void => {
			try {
				const packets = JSON.parse(event.data);
				if (!Array.isArray(packets)) {
					console.warn("Received non-array packet data:", packets);
					return;
				}

				for (const packet of packets) {
					if (!packet.name || !packet.packet) {
						console.warn("Received malformed packet:", packet);
						continue;
					}

					const packetId = packet.id;
					const packetName = packet.name;
					const packetData = packet.packet;

					if (packetId && this.responseHandlers[packetId] && this.responseHandlers[packetId][packetName]) {
						this.handleResponse(packetId, packetName, packetData);
					}
					else if (this.globalPacketHandlers[packetName]) {
						this.globalPacketHandlers[packetName](packetData as never);
					}
					else {
						console.warn(`No response handler for packet ID: ${packetId}, Name: ${packetName}`);
					}
				}
			}
			catch (error) {
				console.error("Error processing WebSocket message:", error);
			}
		};

		this.socket.onerror = (error): void => {
			console.error("WebSocket error:", error);
			this.socket?.close();
			this.setState(AuthStateEnum.CONNECTION_ERROR);
		};

		this.socket.onclose = (error): void => {
			console.log("WebSocket connection closed.");
			if (error.reason === "Unauthorized") {
				console.error("WebSocket authentication failed.");
				this.setState(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED);
			}
			const instance = WebSocketClient.getInstance();
			instance.socket = null; // Reset socket on close
			if (instance.connectionAttempts >= instance.maxConnectionAttempts) {
				console.error("Max connection attempts reached. Stopping reconnection attempts.");
				instance.connectionAttempts = 0; // Reset attempts
				instance.socket = null; // Clear socket
				instance.packetQueue = []; // Clear packet queue
				this.setState(AuthStateEnum.CONNECTION_ERROR);
				return;
			}
			else if (this.packetQueue.length > 0) {
				this.setState(AuthStateEnum.RECONNECTING_PACKET_QUEUE);
			}
			else {
				this.setState(AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE);
			}
			setTimeout(function() {
				console.log("Attempting to reconnect WebSocket...");
				instance.connectionAttempts++;
				instance.connect.bind(instance)(authToken); // Attempt to reconnect after 1 second
			}, 1000);
		};
	}

	private processPacketQueue(): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			while (this.packetQueue.length > 0) {
				const queuedPacket = this.packetQueue.shift();
				if (queuedPacket) {
					this.socket.send(JSON.stringify({
						id: queuedPacket.id,
						name: queuedPacket.packet.constructor.name,
						data: queuedPacket.packet
					}));
				}
			}
		}
		else {
			console.warn("WebSocket is not open. Cannot process packet queue.");
		}
	}

	private cleanResponseHandlers(): void {
		const now = new Date();
		for (const packetId of Object.keys(this.responseHandlers)) {
			for (const packetName of Object.keys(this.responseHandlers[packetId])) {
				const handler = this.responseHandlers[packetId][packetName];
				if (handler.cleanTime < now) {
					delete this.responseHandlers[packetId][packetName];
				}
			}
			if (Object.keys(this.responseHandlers[packetId]).length === 0) {
				delete this.responseHandlers[packetId];
			}
		}
	}

	private handleResponse(packetId: string, packetName: string, packet: FromServerPacket): void {
		if (this.responseHandlers[packetId] && this.responseHandlers[packetId][packetName]) {
			const handler = this.responseHandlers[packetId][packetName];
			handler.callback(packet as never);
			delete this.responseHandlers[packetId][packetName]; // Clean up after handling
			if (Object.keys(this.responseHandlers[packetId]).length === 0) {
				delete this.responseHandlers[packetId]; // Clean up empty packetId
			}
		}
		else {
			console.warn(`No response handler found for packet ID: ${packetId}, Name: ${packetName}`);
		}
	}
}