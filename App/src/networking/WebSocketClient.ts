import { AuthTokenManager } from "./authentication/AuthTokenManager.ts";
import Config from "react-native-config";
import { FromClientPacket } from "../@types/protobufs-client";
import { FromServerPacket } from "../@types/protobufs-server";
import uuid from "react-native-uuid";

export type WebSocketPacketResponseHandler<T extends FromServerPacket> = (packet: T) => void;

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

	public setGlobalPacketHandler(packetName: string, callback: WebSocketPacketResponseHandler<never>): void {
		this.globalPacketHandlers[packetName] = callback;
	}

	public async init(): Promise<void> {
		await this.connect();

		setInterval((): void => {
			this.processPacketQueue();
		}, 1000);

		setInterval((): void => {
			this.cleanResponseHandlers();
		}, 60 * 1000); // Clean response handlers every minute
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

	public sendPacket(packet: FromClientPacket, responseHandlers: {
		[packetName: string]: WebSocketPacketResponseHandler<never>;
	}): void {
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
			console.warn("WebSocket is not open. Queueing packets.");
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
