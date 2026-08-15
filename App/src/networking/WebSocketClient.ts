import uuid from "react-native-uuid";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AuthToken} from "@/src/authentication/AuthToken";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";

export type WebSocketPacketResponseHandler<T extends FromServerPacket> = (packet: T) => void;

interface PacketTimeout {
	time: number;
	callback?: () => void;
}

interface IncomingPacket {
	id?: string;
	name?: string;
	packet?: FromServerPacket;
}

interface ResponseHandler {
	cleanTime: Date;
	callback: WebSocketPacketResponseHandler<never>;
}

interface ResponseHandlerGroup {
	handlers: Map<string, ResponseHandler>;
	received?: boolean;
}

export class WebSocketClient {
	private static instance: WebSocketClient;

	private socket: WebSocket | null = null;

	private connectionAttempts = 0;

	private maxConnectionAttempts = 20;

	private packetQueue: {
		id?: string; packet: FromClientPacket;
	}[] = [];

	private responseHandlers = new Map<string, ResponseHandlerGroup>();

	private globalPacketHandlers = new Map<string, WebSocketPacketResponseHandler<never>>();

	private setState?: (newState: AuthStateEnum) => void;

	private saveToken?: (token: AuthToken) => Promise<void>;

	private processPacketQueueIntervalId: number | null = null;

	private cleanResponseHandlersIntervalId: number | null = null;

	private constructor() {
		// Singleton construction is restricted to getInstance().
	}

	public static getInstance(): WebSocketClient {
		if (!WebSocketClient.instance) {
			WebSocketClient.instance = new WebSocketClient();
		}
		return WebSocketClient.instance;
	}

	public setGlobalPacketHandler(packetName: string, callback: WebSocketPacketResponseHandler<never>): void {
		this.globalPacketHandlers.set(packetName, callback);
	}

	public async init(authToken: AuthToken, setState: (newState: AuthStateEnum) => void, saveToken: (token: AuthToken) => Promise<void>): Promise<void> {
		this.setState = setState;
		this.saveToken = saveToken;

		this.setState?.(AuthStateEnum.CONNECTING);
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
	}, timeout?: PacketTimeout): void {
		console.debug("Sending packet:", packet);
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			console.warn("WebSocket is not open. Packet will be queued.");
			this.packetQueue.push({ packet });
			this.setState?.(AuthStateEnum.RECONNECTING_PACKET_QUEUE);
			return;
		}

		const packetId = this.registerResponseHandlers(responseHandlers);
		this.packetQueue.push({
			packet,
			...(packetId ? { id: packetId } : {})
		});
		if (packetId && timeout) {
			this.scheduleResponseHandlerCleanup(packetId, timeout);
		}
		this.processPacketQueue();
	}

	private registerResponseHandlers(responseHandlers: {
		[packetName: string]: WebSocketPacketResponseHandler<never>;
	}): string | null {
		if (Object.keys(responseHandlers).length === 0) {
			return null;
		}

		const packetId = uuid.v4();
		const handlers = new Map<string, ResponseHandler>();
		this.responseHandlers.set(packetId, { handlers });
		for (const [packetName, callback] of Object.entries(responseHandlers)) {
			handlers.set(packetName, {
				cleanTime: new Date(Date.now() + 10 * 60 * 60 * 1000),
				callback
			});
		}
		return packetId;
	}

	private scheduleResponseHandlerCleanup(packetId: string, timeout: PacketTimeout): void {
		setTimeout((): void => {
			const responseHandlerGroup = this.responseHandlers.get(packetId);
			if (!responseHandlerGroup) {
				return;
			}

			for (const packetName of responseHandlerGroup.handlers.keys()) {
				responseHandlerGroup.handlers.delete(packetName);
			}
			if (timeout.callback && !responseHandlerGroup.received) {
				timeout.callback();
			}
			this.responseHandlers.delete(packetId);
		}, timeout.time);
	}

	private getWebSocketUrl(): string {
		const webSocketUrl = process.env.EXPO_PUBLIC_WEBSOCKET_URL;
		if (!webSocketUrl) {
			throw new Error("WebSocket URL is not defined in environment variables.");
		}
		return webSocketUrl;
	}

	private async getAccessToken(authToken: AuthToken): Promise<string | null> {
		if (await authToken.refreshIfNeeded()) {
			console.debug("Token refreshed successfully:", authToken);
			await this.saveToken?.(authToken);
		}

		const accessToken = authToken.getAccessToken();
		if (!accessToken) {
			console.error("No access token available for WebSocket connection.");
			this.setState?.(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED);
			return null;
		}
		return accessToken;
	}

	private async connect(authToken: AuthToken, firstConnection: boolean): Promise<void> {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.setState?.(AuthStateEnum.LOGGED_IN);
			return;
		}

		const webSocketUrl = this.getWebSocketUrl();
		const accessToken = await this.getAccessToken(authToken);
		if (!accessToken) {
			return;
		}

		let firstConnectionFlag = firstConnection;
		this.socket = new WebSocket(`${webSocketUrl}?token=${accessToken}`);

		this.socket.onopen = (): void => {
			this.handleSocketOpen();
			firstConnectionFlag = false;
		};

		this.socket.onmessage = (event): void => this.handleMessage(event);

		this.socket.onerror = (error): void => this.handleSocketError(error);

		this.socket.onclose = (error): void => this.handleSocketClose(error, authToken, firstConnectionFlag);
	}

	private handleSocketOpen(): void {
		console.log("WebSocket connection established.");
		this.connectionAttempts = 0;
		this.setState?.(AuthStateEnum.LOGGED_IN);
	}

	private handleMessage(event: MessageEvent): void {
		try {
			const packets = JSON.parse(event.data) as IncomingPacket[];
			if (!Array.isArray(packets)) {
				console.warn("Received non-array packet data:", packets);
				return;
			}

			for (const packet of packets) {
				this.handleIncomingPacket(packet);
			}
		}
		catch (error) {
			console.error("Error processing WebSocket message:", error);
		}
	}

	private handleIncomingPacket(packet: IncomingPacket): void {
		if (!packet.name || !packet.packet) {
			console.warn("Received malformed packet:", packet);
			return;
		}

		console.debug("Received packet:", JSON.stringify(packet));
		const packetId = packet.id;
		const packetName = packet.name;
		const packetData = packet.packet;

		const responseHandlerGroup = packetId ? this.responseHandlers.get(packetId) : undefined;
		if (packetId && responseHandlerGroup?.handlers.has(packetName)) {
			this.handleResponse(packetId, packetName, packetData);
			return;
		}
		const globalPacketHandler = this.globalPacketHandlers.get(packetName);
		if (globalPacketHandler) {
			globalPacketHandler(packetData as never);
			return;
		}
		console.warn(`No response handler for packet ID: ${packetId}, Name: ${packetName}`);
	}

	private handleSocketError(error: Event): void {
		console.info("WebSocket error:", error);
		this.socket?.close();
		this.setState?.(AuthStateEnum.CONNECTION_ERROR);
		this.clearIntervals();
	}

	private handleSocketClose(error: CloseEvent, authToken: AuthToken, firstConnection: boolean): void {
		console.log("WebSocket connection closed.");
		if (error.reason === "Unauthorized") {
			this.handleUnauthorizedClose();
			return;
		}

		this.socket = null;
		if (firstConnection || this.connectionAttempts >= this.maxConnectionAttempts) {
			this.handleReconnectFailure(firstConnection);
			return;
		}

		this.setReconnectingState();
		this.scheduleReconnect(authToken);
	}

	private handleUnauthorizedClose(): void {
		console.error("WebSocket authentication failed.");
		this.setState?.(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED);
		this.clearIntervals();
	}

	private handleReconnectFailure(firstConnection: boolean): void {
		if (!firstConnection) {
			console.error("Max connection attempts reached. Stopping reconnection attempts.");
		}
		this.connectionAttempts = 0;
		this.socket = null;
		this.packetQueue = [];
		this.setState?.(AuthStateEnum.CONNECTION_ERROR);
		this.clearIntervals();
	}

	private setReconnectingState(): void {
		const state = this.packetQueue.length > 0
			? AuthStateEnum.RECONNECTING_PACKET_QUEUE
			: AuthStateEnum.RECONNECTING_NO_PACKET_QUEUE;
		this.setState?.(state);
	}

	private scheduleReconnect(authToken: AuthToken): void {
		setTimeout((): void => {
			console.log("Attempting to reconnect WebSocket...");
			this.connectionAttempts++;
			this.connect(authToken, false).catch((error) => {
				console.error("Failed to reconnect WebSocket:", error);
			});
		}, 1000);
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
		for (const [packetId, responseHandlerGroup] of this.responseHandlers) {
			for (const [packetName, handler] of responseHandlerGroup.handlers) {
				if (handler && handler.cleanTime < now) {
					responseHandlerGroup.handlers.delete(packetName);
				}
			}
			if (responseHandlerGroup.handlers.size === 0) {
				this.responseHandlers.delete(packetId);
			}
		}
	}

	private handleResponse(packetId: string, packetName: string, packet: FromServerPacket): void {
		const responseHandlerGroup = this.responseHandlers.get(packetId);
		if (responseHandlerGroup) {
			responseHandlerGroup.received = true;
			const handler = responseHandlerGroup.handlers.get(packetName);
			if (handler) {
				handler.callback(packet as never);
				responseHandlerGroup.handlers.delete(packetName);
				if (responseHandlerGroup.handlers.size === 0) {
					this.responseHandlers.delete(packetId);
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