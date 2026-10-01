import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {WebSocket} from "ws";
import {WebSocketServer} from "../../src/services/WebSocketServer";
import {APP_PROTOCOL_QUERY_PARAMETER, APP_PROTOCOL_VERSION} from "../../../WsPackets/src/AppCompatibility";
import {WEBSOCKET_SESSION_REPLACED_REASON} from "../../../WsPackets/src/WebSocketCloseReasons";

const mocks = vi.hoisted(() => ({
	server: {on: vi.fn()},
	publish: vi.fn(),
	translator: vi.fn(),
	checkToken: vi.fn(),
	getGroups: vi.fn()
}));

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
	close = vi.fn((): void => { this.readyState = WebSocket.CLOSING; });
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
});