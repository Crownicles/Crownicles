import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {WebSocket} from "ws";
import {WebSocketServer} from "../../src/services/WebSocketServer";
import {APP_PROTOCOL_QUERY_PARAMETER, APP_PROTOCOL_VERSION} from "../../../WsPackets/src/AppCompatibility";
import {WEBSOCKET_AUTH_UNAVAILABLE_REASON, WEBSOCKET_SESSION_REPLACED_REASON} from "../../../WsPackets/src/WebSocketCloseReasons";
import {AppPresenceReq} from "../../../WsPackets/src/fromClient/AppPresenceReq";
import {WebSocketConstants} from "../../src/constants/WebSocketConstants";

const mocks = vi.hoisted(() => ({
	server: {on: vi.fn()},
	publish: vi.fn(),
	translator: vi.fn(),
	checkToken: vi.fn(),
	getGroups: vi.fn(),
	collision: vi.fn()
}));

vi.mock("../../src/services/AccountCollisionService", () => ({AccountCollisionService: class { check = mocks.collision; }}));

vi.mock("ws", async importOriginal => ({
	...await importOriginal<typeof import("ws")>(),
	Server: vi.fn(function (): typeof mocks.server { return mocks.server; })
}));
vi.mock("../../src/index", () => ({keycloakConfig: {}}));
vi.mock("../../src/mqtt/MqttManager", () => ({MqttManager: {globalMqttClient: {sendToBackEnd: mocks.publish}}}));
vi.mock("../../src/packets/fromClient/FromClientTranslator", () => ({getClientTranslator: (): typeof mocks.translator => mocks.translator}));
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", () => ({KeycloakUtils: {checkTokenAndGetKeycloakId: mocks.checkToken, getUserGroups: mocks.getGroups}}));

class SocketStub {
	readyState: number = WebSocket.OPEN;
	on = vi.fn();
	send = vi.fn();
	ping = vi.fn();
	close = vi.fn((): void => { this.readyState = WebSocket.CLOSING; });
	terminate = vi.fn((): void => {
		this.readyState = WebSocket.CLOSED;
		emit(this, "close");
	});
}

function emit(socket: SocketStub, event: string): void {
	(socket.on.mock.calls.find(([name]) => name === event)?.[1] as (() => void) | undefined)?.();
}

function presence(foreground: boolean): string {
	return JSON.stringify({name: AppPresenceReq.wireName, data: {foreground}});
}

const PLAYER = "shared-account";
const REQUEST = JSON.stringify({id: "request", name: "command", data: {}});
const CONNECTION_REQUEST = {
	url: `/?token=local-test&${APP_PROTOCOL_QUERY_PARAMETER}=${APP_PROTOCOL_VERSION}`,
	socket: {remoteAddress: "127.0.0.1", remotePort: 1}
};

async function connect(socket: SocketStub): Promise<void> {
	const handler = mocks.server.on.mock.calls.find(([event]) => event === "connection")?.[1] as (socket: SocketStub, request: typeof CONNECTION_REQUEST) => Promise<void>;
	await handler(socket, CONNECTION_REQUEST);
}

async function send(socket: SocketStub, message: string = REQUEST): Promise<void> {
	const handler = socket.on.mock.calls.find(([event]) => event === "message")?.[1] as (message: string) => Promise<void>;
	await handler(message);
}

describe("WebSocket session ownership", () => {
	beforeEach((): void => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mocks.checkToken.mockResolvedValue({isError: false, payload: {keycloakId: PLAYER}});
		mocks.getGroups.mockResolvedValue({isError: false, payload: {groups: []}});
		mocks.translator.mockResolvedValue({translated: true});
		mocks.collision.mockResolvedValue({collision: null});
		WebSocketServer.start(0);
	});

	afterEach((): void => {
		Reflect.set(WebSocketServer, "server", undefined);
		Reflect.get(WebSocketServer, "keycloakIdToClients").clear();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("publishes only the active phone's actions and preserves it after the old socket closes", async (): Promise<void> => {
		const previous = new SocketStub();
		const current = new SocketStub();
		await connect(previous);
		await connect(current);
		expect(previous.close).toHaveBeenCalledWith(1008, WEBSOCKET_SESSION_REPLACED_REASON);
		const onClose = previous.on.mock.calls.find(([event]) => event === "close")?.[1] as () => void;
		onClose();
		await send(previous);
		expect(mocks.publish).not.toHaveBeenCalled();
		await send(current);
		expect(mocks.publish).toHaveBeenCalledTimes(1);
		expect(mocks.publish.mock.calls[0][0].keycloakId).toBe(PLAYER);
	});

	it("drops an action translated while a second phone replaces its session", async (): Promise<void> => {
		const previous = new SocketStub();
		await connect(previous);
		let finish!: (packet: object) => void;
		mocks.translator.mockReturnValueOnce(new Promise<object>(resolve => { finish = resolve; }));
		const pending = send(previous);
		await connect(new SocketStub());
		finish({translated: true});
		await pending;
		expect(mocks.publish).not.toHaveBeenCalled();
	});

	it("does not let a closed socket reclaim the account after delayed authentication", async (): Promise<void> => {
		let finish!: (result: object) => void;
		mocks.checkToken.mockReturnValueOnce(new Promise<object>(resolve => { finish = resolve; }));
		const previous = new SocketStub();
		const pending = connect(previous);
		const current = new SocketStub();
		await connect(current);
		previous.readyState = WebSocket.CLOSED;
		finish({isError: false, payload: {keycloakId: PLAYER}});
		await pending;
		await send(current);
		expect(current.close).not.toHaveBeenCalled();
		expect(mocks.publish).toHaveBeenCalledTimes(1);
	});

	it.each([
		null, 1, "text", [], {name: "command", data: null}, {name: "command", data: []},
		{name: {}, data: {}}, {name: "command", data: {}, id: 1},
		{data: {}}, {name: "", data: {}}, {name: "command", data: 1}, {name: "command", data: {}, id: null}
	].map(envelope => ({envelope})))("ignores malformed envelopes without publishing or rejecting the message handler ($envelope)", async ({envelope}): Promise<void> => {
		const socket = new SocketStub();
		await connect(socket);
		await expect(send(socket, JSON.stringify(envelope))).resolves.toBeUndefined();
		expect(mocks.translator).not.toHaveBeenCalled();
		expect(mocks.publish).not.toHaveBeenCalled();
	});

	it("accepts fire-and-forget packets without a correlation id", async (): Promise<void> => {
		const socket = new SocketStub();
		await connect(socket);
		await send(socket, JSON.stringify({name: "command", data: {}}));
		expect(mocks.publish).toHaveBeenCalledTimes(1);
	});

	it("does not let a custom client enter the game while its collision is unresolved", async (): Promise<void> => {
		mocks.collision.mockResolvedValue({collision: {email: "same@example.test"}});
		const socket = new SocketStub();
		await connect(socket);
		expect(socket.close).toHaveBeenCalledWith(1008, "Account collision requires resolution");
		expect(socket.on.mock.calls.some(([event]) => event === "message")).toBe(false);
		expect(mocks.publish).not.toHaveBeenCalled();
	});

	it.each(["collision", "checkToken"] as const)("refuses access without expiring the session when %s is unavailable", async boundary => {
		mocks[boundary].mockRejectedValue(new TypeError("Network unavailable"));
		const socket = new SocketStub();
		await connect(socket);
		expect(socket.close).toHaveBeenCalledWith(1008, WEBSOCKET_AUTH_UNAVAILABLE_REASON);
		expect(socket.on.mock.calls.some(([event]) => event === "message")).toBe(false);
		expect(mocks.publish).not.toHaveBeenCalled();
	});

	it("keeps a Keycloak server error distinct from an invalid token", async () => {
		mocks.checkToken.mockResolvedValue({isError: true, status: 503});
		const socket = new SocketStub();
		await connect(socket);
		expect(socket.close).toHaveBeenCalledWith(1008, WEBSOCKET_AUTH_UNAVAILABLE_REASON);
	});

	it("follows whether the app is in front of the player, without bothering Core", async () => {
		const socket = new SocketStub();
		await connect(socket);
		expect(WebSocketServer.isInForeground(PLAYER)).toBe(false);
		await send(socket, presence(true));
		expect(WebSocketServer.isInForeground(PLAYER)).toBe(true);
		await send(socket, presence(false));
		expect(WebSocketServer.isInForeground(PLAYER)).toBe(false);
		expect(mocks.translator).not.toHaveBeenCalled();
		expect(mocks.publish).not.toHaveBeenCalled();
	});

	it("does not lend the foreground of a replaced phone to the one taking over", async () => {
		const previous = new SocketStub();
		await connect(previous);
		await send(previous, presence(true));
		await connect(new SocketStub());
		expect(WebSocketServer.isInForeground(PLAYER)).toBe(false);
	});

	it("closes a connection that stopped answering, so a phone gone silent no longer counts as open", async () => {
		const silent = new SocketStub();
		await connect(silent);
		await send(silent, presence(true));
		await vi.advanceTimersByTimeAsync(WebSocketConstants.HEARTBEAT_INTERVAL);
		expect(silent.ping).toHaveBeenCalledOnce();
		expect(WebSocketServer.isInForeground(PLAYER)).toBe(true);
		await vi.advanceTimersByTimeAsync(WebSocketConstants.HEARTBEAT_INTERVAL);
		expect(silent.terminate).toHaveBeenCalledOnce();
		expect(WebSocketServer.isInForeground(PLAYER)).toBe(false);
		expect(WebSocketServer.isConnected(PLAYER)).toBe(false);
	});

	it("keeps a connection that answers the heartbeat", async () => {
		const socket = new SocketStub();
		await connect(socket);
		await vi.advanceTimersByTimeAsync(WebSocketConstants.HEARTBEAT_INTERVAL);
		emit(socket, "pong");
		await vi.advanceTimersByTimeAsync(WebSocketConstants.HEARTBEAT_INTERVAL);
		expect(socket.terminate).not.toHaveBeenCalled();
		expect(socket.ping).toHaveBeenCalledTimes(2);
		expect(WebSocketServer.isConnected(PLAYER)).toBe(true);
	});
});