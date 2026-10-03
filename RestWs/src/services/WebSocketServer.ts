import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../index";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ContextConstants } from "../constants/ContextConstants";
import { RightGroup } from "../../../Lib/src/types/RightGroup";
import { MqttManager } from "../mqtt/MqttManager";
import { IncomingMessage } from "http";
import { WebSocketConstants } from "../constants/WebSocketConstants";
import { getClientTranslator } from "../packets/fromClient/FromClientTranslator";
import { InvalidClientPacketError } from "../packets/fromClient/InvalidClientPacketError";
import { AccountCollisionService } from "./AccountCollisionService";
import {
	WEBSOCKET_APP_OUTDATED_REASON, WEBSOCKET_SERVER_OUTDATED_REASON, WEBSOCKET_SESSION_REPLACED_REASON, WEBSOCKET_ACCOUNT_COLLISION_REASON, WebSocketCloseReason
} from "../../../WsPackets/src/WebSocketCloseReasons";
import {
	APP_COMPATIBILITY_STATUSES, APP_PROTOCOL_QUERY_PARAMETER, APP_PROTOCOL_VERSION, compareProtocolVersions
} from "../../../WsPackets/src/AppCompatibility";
import { FromClientPacket } from "../../../WsPackets/src/fromClient/FromClientPacket";
import {
	Server, WebSocket
} from "ws";

type ClientMessage = {
	id?: string;
	name: string;
	data: FromClientPacket;
};

/** The Keycloak subject a socket is registered under. */
type KeycloakId = string;

/** Who a verified socket belongs to, and the rights Keycloak grants them. */
type ConnectedPlayer = {
	keycloakId: string;
	groups: string[];
};

/** The packet a player sent that could not reach the back end. */
type FailedClientPacket = {
	keycloakId: string;
	packetName: string;
};

function isClientRecord(value: unknown): value is Record<string, unknown> {
	if (value === null) {
		return false;
	}
	if (typeof value !== "object") {
		return false;
	}
	return !Array.isArray(value);
}

function isClientMessage(value: unknown): value is ClientMessage {
	if (!isClientRecord(value)) {
		return false;
	}
	if (typeof value.name !== "string") {
		return false;
	}
	if (value.name.length === 0) {
		return false;
	}
	if (!isClientRecord(value.data)) {
		return false;
	}
	return !("id" in value) || typeof value.id === "string";
}

/**
 * Parse a raw client message, or return null when it is not a packet
 * @param message
 */
function parseClientMessage(message: string): ClientMessage | null {
	let parsedMessage: unknown;
	try {
		parsedMessage = JSON.parse(message);
	}
	catch (_) {
		// Ignore invalid JSON
		return null;
	}

	if (!isClientMessage(parsedMessage)) {
		CrowniclesLogger.debug("Invalid message format", { parsedMessage });
		return null;
	}
	return {
		name: parsedMessage.name,
		data: parsedMessage.data,
		...typeof parsedMessage.id === "string" ? { id: parsedMessage.id } : {}
	};
}

/**
 * Log why a client packet could not reach the back end
 * @param error
 * @param packet
 */
function logClientPacketFailure(error: unknown, packet: FailedClientPacket): void {
	if (error instanceof InvalidClientPacketError) {
		// Dropping the packet is enough: a client mistake must not show up as a server error
		CrowniclesLogger.warn("Rejected client packet", {
			...packet,
			reason: error.message
		});
		return;
	}
	CrowniclesLogger.errorWithObj("Error while sending MQTT message", error);
}

/**
 * Handle the message received from the client
 * @param ws
 * @param player
 */
function handleClientMessage(ws: WebSocket, {
	keycloakId, groups
}: ConnectedPlayer): void {
	ws.on("message", async (message: string) => {
		if (!WebSocketServer.isActiveConnection(keycloakId, ws)) {
			return;
		}
		const parsedMessage = parseClientMessage(message);
		if (!parsedMessage) {
			return;
		}

		// Log the received message
		CrowniclesLogger.debug("Received message from client", {
			keycloakId,
			packet: {
				name: parsedMessage.name,
				data: parsedMessage.data
			}
		});

		const translator = getClientTranslator(parsedMessage.name);
		if (!translator) {
			CrowniclesLogger.debug("No translator found for message", { parsedMessage });
			return;
		}

		// Create the context for the message and send it to the back end
		try {
			const context: PacketContext = {
				packetId: parsedMessage.id,
				frontEndOrigin: ContextConstants.FRONT_END_ORIGIN,
				frontEndSubOrigin: ContextConstants.FRONT_END_SUB_ORIGIN,
				keycloakId,
				rightGroups: groups as RightGroup[],
				webSocket: {}
			};

			// todo verify that all properties are present in the message
			const packet = await translator(context, parsedMessage.data);
			if (WebSocketServer.isActiveConnection(keycloakId, ws)) {
				MqttManager.globalMqttClient.sendToBackEnd(context, packet);
			}
		}
		catch (error) {
			logClientPacketFailure(error, {
				keycloakId,
				packetName: parsedMessage.name
			});
		}
	});
}

/**
 * WebSocket server class
 */
export class WebSocketServer {
	/*
	 * todo store message in a queue if the client is not connected (stored in a database)
	 */

	/**
	 * WebSocket server instance
	 */
	private static server: Server;

	/**
	 * Map of keycloakId to WebSocket client
	 */
	private static keycloakIdToClients: Map<string, WebSocket> = new Map();

	/**
	 * Start the WebSocket server
	 * @param port
	 */
	static start(port: number): void {
		if (WebSocketServer.server) {
			CrowniclesLogger.warn("WebSocket server already started");
			return;
		}

		WebSocketServer.server = new Server({
			port, host: "0.0.0.0"
		});

		WebSocketServer.handleListening(port);
		WebSocketServer.handleConnection();
		WebSocketServer.programClosedConnectionsPurge();
	}

	/**
	 * Handle the listening event
	 * @param port
	 */
	private static handleListening(port: number): void {
		WebSocketServer.server.on("listening", () => {
			CrowniclesLogger.info("WebSocket server started", {
				port
			});
		});
	}

	/**
	 * Handle the connection event
	 */
	private static handleConnection(): void {
		WebSocketServer.server.on("connection", async (ws, req) => {
			try {
				// Verify the client connection and get the keycloakId and groups
				const connectionData = await WebSocketServer.verifyClientConnection(ws, req);
				if (!connectionData || ws.readyState !== WebSocket.OPEN) {
					return;
				}
				const { keycloakId } = connectionData;

				// Close the previous connection if it exists and save the new one
				WebSocketServer.replaceConnection(keycloakId, ws);

				// Handle the message received from the client
				handleClientMessage(ws, connectionData);

				// Handle the close event
				ws.on("close", () => WebSocketServer.handleClose(ws, req, keycloakId));
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Error during WebSocket connection", error);
			}
		});
	}

	private static replaceConnection(keycloakId: KeycloakId, ws: WebSocket): void {
		const currConnection = WebSocketServer.keycloakIdToClients.get(keycloakId);
		WebSocketServer.keycloakIdToClients.set(keycloakId, ws);
		if (currConnection && currConnection.readyState !== WebSocket.CLOSED) {
			currConnection.close(1008, WEBSOCKET_SESSION_REPLACED_REASON);
		}
	}

	static isActiveConnection(keycloakId: KeycloakId, ws: WebSocket): boolean {
		return ws.readyState === WebSocket.OPEN && WebSocketServer.keycloakIdToClients.get(keycloakId) === ws;
	}

	private static handleClose(ws: WebSocket, req: IncomingMessage, keycloakId: KeycloakId): void {
		CrowniclesLogger.info("Client disconnected", {
			ip: req.socket.remoteAddress,
			port: req.socket.remotePort,
			keycloakId
		});

		/*
		 * A reconnect closes the previous socket after the new one has been registered. Do not
		 * let that delayed close event remove the active connection.
		 */
		if (WebSocketServer.keycloakIdToClients.get(keycloakId) === ws) {
			WebSocketServer.keycloakIdToClients.delete(keycloakId);
		}
	}

	private static refuse(ws: WebSocket, reason: string): null {
		ws.close(1008, reason);
		return null;
	}

	/**
	 * Why an app speaking another protocol version cannot play, if it does
	 * @param query
	 */
	private static outdatedReason(query: URLSearchParams): string | null {
		// An app without the parameter predates the check, so it is outdated too
		const compatibility = compareProtocolVersions(Number(query.get(APP_PROTOCOL_QUERY_PARAMETER)), APP_PROTOCOL_VERSION);
		if (compatibility === APP_COMPATIBILITY_STATUSES.UP_TO_DATE) {
			return null;
		}
		return compatibility === APP_COMPATIBILITY_STATUSES.APP_OUTDATED ? WEBSOCKET_APP_OUTDATED_REASON : WEBSOCKET_SERVER_OUTDATED_REASON;
	}

	private static async tokenOwner(token: string): Promise<KeycloakId | null> {
		const checkToken = await KeycloakUtils.checkTokenAndGetKeycloakId(keycloakConfig, token);
		return checkToken.isError ? null : checkToken.payload.keycloakId;
	}

	/**
	 * Two accounts sharing an email must be settled first; when that cannot be checked, the session waits too
	 * @param token
	 */
	private static async collisionBlocks(token: string): Promise<boolean> {
		try {
			const collision = await new AccountCollisionService(keycloakConfig).check(token);
			return Boolean(collision.collision || collision.pending);
		}
		catch {
			return true;
		}
	}

	/**
	 * Verify the client connection and get the keycloakId and groups
	 * @param ws
	 * @param req
	 */
	static async verifyClientConnection(ws: WebSocket, req: IncomingMessage): Promise<ConnectedPlayer | null> {
		const query = new URL(req.url ?? "", "ws://localhost").searchParams;
		const outdated = WebSocketServer.outdatedReason(query);
		if (outdated) {
			return WebSocketServer.refuse(ws, outdated);
		}

		const token = query.get("token");
		const keycloakId = token ? await WebSocketServer.tokenOwner(token) : null;
		if (!token || !keycloakId) {
			return WebSocketServer.refuse(ws, "Unauthorized");
		}
		if (await WebSocketServer.collisionBlocks(token)) {
			return WebSocketServer.refuse(ws, WEBSOCKET_ACCOUNT_COLLISION_REASON);
		}

		// Get the groups of the user
		const groups = await KeycloakUtils.getUserGroups(keycloakConfig, keycloakId);
		if (groups.isError) {
			return WebSocketServer.refuse(ws, "Error while getting user groups");
		}

		// Log the connection
		CrowniclesLogger.info("New client connected", {
			ip: req.socket.remoteAddress,
			port: req.socket.remotePort,
			keycloakId
		});

		return {
			keycloakId,
			groups: groups.payload.groups
		};
	}

	/**
	 * Purge the closed connections regularly
	 */
	private static programClosedConnectionsPurge(): void {
		setInterval(() => {
			WebSocketServer.keycloakIdToClients.forEach((client, keycloakId) => {
				if (!client || client.readyState === WebSocket.CLOSED) {
					WebSocketServer.keycloakIdToClients.delete(keycloakId);
				}
			});
		}, WebSocketConstants.PURGE_INTERVAL);
	}

	/**
	 * Whether the player has the app open right now
	 * @param keycloakId
	 */
	static isConnected(keycloakId: string): boolean {
		return WebSocketServer.keycloakIdToClients.get(keycloakId)?.readyState === WebSocket.OPEN;
	}

	/**
	 * Dispatch packets to the client
	 * @param keycloakId
	 * @param packets
	 */
	static dispatchPacketsToClient(keycloakId: string, packets: {
		name: string;
		packet: object;
	}[]): void {
		const client = WebSocketServer.keycloakIdToClients.get(keycloakId);
		if (client) {
			client.send(JSON.stringify(packets));
		}
		else {
			CrowniclesLogger.warn("Client not found", { keycloakId });
		}
	}

	/**
	 * Send packets to every connected client
	 * @param packets
	 */
	static broadcastPackets(packets: {
		name: string;
		packet: object;
	}[]): void {
		const message = JSON.stringify(packets);
		WebSocketServer.keycloakIdToClients.forEach(client => {
			if (client.readyState === client.OPEN) {
				client.send(message);
			}
		});
	}

	/**
	 * Close the connection of a user, if any is currently open
	 * @param keycloakId
	 * @param reason
	 */
	static closeConnection(keycloakId: KeycloakId, reason: WebSocketCloseReason): void {
		const client = WebSocketServer.keycloakIdToClients.get(keycloakId);
		if (!client) {
			return;
		}

		if (client.readyState !== WebSocket.CLOSED) {
			client.close(1008, reason);
		}
		WebSocketServer.keycloakIdToClients.delete(keycloakId);
	}
}
