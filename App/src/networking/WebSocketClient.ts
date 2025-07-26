import {FromClientPacket} from "../@types/protobufs-client";
import {FromServerPacket} from "../@types/protobufs-server";
import uuid from "react-native-uuid";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
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
			handlers: {
				[packetName: string]: {
					cleanTime: Date;
					callback: WebSocketPacketResponseHandler<never>;
				};
			};
			received?: boolean; // Track if the packet has been received
		}
	} = {};

	private globalPacketHandlers: {
		[packetName: string]: WebSocketPacketResponseHandler<never>;
	} = {};

	private setState: (newState: AuthStateEnum) => void = () => {};

	private saveToken: (token: AuthToken) => Promise<void> = async () => {};

	private processPacketQueueIntervalId: number | null = null;

	private cleanResponseHandlersIntervalId: number | null = null;

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

		this.setState(AuthStateEnum.CONNECTING);
		await this.connect(authToken, true);

		this.processPacketQueueIntervalId = setInterval((): void => {
			this.processPacketQueue();
		}, 1000);

		this.cleanResponseHandlersIntervalId = setInterval((): void => {
			this.cleanResponseHandlers();
		}, 60 * 1000); // Clean response handlers every minute
	}

	public sendPacket(packet: FromClientPacket, responseHandlers: {
		[packetName: string]: WebSocketPacketResponseHandler<never>;
	}, timeout?: {
		time: number; // Timeout in milliseconds
		callback?: () => void;
	}): void {
		console.debug("Sending packet:", packet);
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			console.warn("WebSocket is not open. Packet will be queued.");
			this.packetQueue.push({ packet });
			this.setState(AuthStateEnum.RECONNECTING_PACKET_QUEUE);
			return;
		}
		if (Object.keys(responseHandlers).length > 0) {
			const packetId = uuid.v4(); // Generate a unique ID for the packet
			this.responseHandlers[packetId] = { handlers: {} };
			for (const [packetName, callback] of Object.entries(responseHandlers)) {
				this.responseHandlers[packetId].handlers[packetName] = {
					cleanTime: new Date(Date.now() + 10 * 60 * 60 * 1000), // Set a default timeout of 10 minutes
					callback
				};
			}

			this.packetQueue.push({
				packet, id: packetId
			});

			if (timeout) {
				setTimeout(() => {
					// Clean up response handlers after timeout
					for (const packetName of Object.keys(this.responseHandlers[packetId].handlers)) {
						delete this.responseHandlers[packetId].handlers[packetName];
					}
					if (timeout.callback && !this.responseHandlers[packetId].received) {
						timeout.callback();
					}
					delete this.responseHandlers[packetId]; // Clean up the packetId entry
				}, timeout.time);
			}
		}
		else {
			this.packetQueue.push({ packet });
		}
		this.processPacketQueue();
	}

	private async connect(authToken: AuthToken, firstConnection: boolean): Promise<void> {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.setState(AuthStateEnum.LOGGED_IN);
			return; // Already connected
		}

		let firstConnectionFlag = firstConnection;

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

		this.socket.onopen = (): void => {
			console.log("WebSocket connection established.");
			this.connectionAttempts = 0; // Reset connection attempts on successful connection
			this.setState(AuthStateEnum.LOGGED_IN);
			firstConnectionFlag = false; // Reset first connection flag after successful connection
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

					console.debug("Received packet:", packet);

					const packetId = packet.id;
					const packetName = packet.name;
					const packetData = packet.packet;

					if (packetId && this.responseHandlers[packetId] && this.responseHandlers[packetId].handlers[packetName]) {
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
			console.info("WebSocket error:", error);
			this.socket?.close();
			this.setState(AuthStateEnum.CONNECTION_ERROR);
			this.clearIntervals();
		};

		this.socket.onclose = (error): void => {
			console.log("WebSocket connection closed.");
			if (error.reason === "Unauthorized") {
				console.error("WebSocket authentication failed.");
				this.setState(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED);
				this.clearIntervals();
				return;
			}
			const instance = WebSocketClient.getInstance();
			instance.socket = null; // Reset socket on close
			if (firstConnectionFlag || instance.connectionAttempts >= instance.maxConnectionAttempts) {
				if (!firstConnectionFlag) {
					console.error("Max connection attempts reached. Stopping reconnection attempts.");
				}
				instance.connectionAttempts = 0; // Reset attempts
				instance.socket = null; // Clear socket
				instance.packetQueue = []; // Clear packet queue
				this.setState(AuthStateEnum.CONNECTION_ERROR);
				this.clearIntervals();
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
				instance.connect.bind(instance)(authToken, false); // Attempt to reconnect after 1 second
			}, 1000);
		};
	}

	private processPacketQueue(): void {
		while (this.packetQueue.length > 0) {
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				const queuedPacket = this.packetQueue.shift();
				if (queuedPacket) {
					this.socket.send(JSON.stringify({
						id: queuedPacket.id,
						name: queuedPacket.packet.constructor.name,
						data: queuedPacket.packet
					}));
				}
			}
			else {
				console.warn("WebSocket is not open. Cannot process packet queue.");
				break;
			}
		}
	}

	private cleanResponseHandlers(): void {
		const now = new Date();
		for (const packetId of Object.keys(this.responseHandlers)) {
			for (const packetName of Object.keys(this.responseHandlers[packetId])) {
				const handler = this.responseHandlers[packetId].handlers[packetName];
				if (handler.cleanTime < now) {
					delete this.responseHandlers[packetId].handlers[packetName];
				}
			}
			if (Object.keys(this.responseHandlers[packetId]).length === 0) {
				delete this.responseHandlers[packetId];
			}
		}
	}

	private handleResponse(packetId: string, packetName: string, packet: FromServerPacket): void {
		if (this.responseHandlers[packetId]) {
			this.responseHandlers[packetId].received = true; // Mark the packet as received
			if (this.responseHandlers[packetId].handlers[packetName]) {
				const handler = this.responseHandlers[packetId].handlers[packetName];
				handler.callback(packet as never);
				delete this.responseHandlers[packetId].handlers[packetName]; // Clean up after handling
				if (Object.keys(this.responseHandlers[packetId]).length === 0) {
					delete this.responseHandlers[packetId]; // Clean up empty packetId
				}
			}
			else {
				console.warn(`No response handler found for packet ID: ${packetId}, Name: ${packetName}`);
			}
		}
		else {
			console.warn(`No response handlers found for packet ID: ${packetId}`);
		}
	}

	private clearIntervals(): void {
		if (this.processPacketQueueIntervalId !== null) {
			clearInterval(this.processPacketQueueIntervalId);
			this.processPacketQueueIntervalId = null;
		}
		if (this.cleanResponseHandlersIntervalId !== null) {
			clearInterval(this.cleanResponseHandlersIntervalId);
			this.cleanResponseHandlersIntervalId = null;
		}
	}
}