import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {WEBSOCKET_SESSION_REPLACED_REASON} from "ws-packets/src/WebSocketCloseReasons";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AuthToken} from "@/src/authentication/AuthToken";

// The identifiers deliberately differ from the class names: a minified bundle mangles the latter.
class TestRequest extends FromClientPacket {
	static readonly wireName = "test.request";
}
class TestResponse extends FromServerPacket {
	static readonly wireName = "test.response";

	value!: string;
}

type TestSocket = {
	readyState: number;
	send: jest.Mock;
	close: jest.Mock;
};

const OPEN_STATE = 1;

function clientWithSocket(socket?: TestSocket): {client: WebSocketClient; socket: TestSocket} {
	const client = Reflect.construct(WebSocketClient, []) as WebSocketClient;
	const testSocket = socket ?? {
		readyState: OPEN_STATE,
		send: jest.fn(),
		close: jest.fn()
	};
	Reflect.set(client, "socket", testSocket);
	return {client, socket: testSocket};
}

function handleIncomingPacket(client: WebSocketClient, packet: unknown): void {
	const handler = Reflect.get(client, "handleIncomingPacket") as (packet: unknown) => void;
	handler.call(client, packet);
}

function handleSocketOpen(client: WebSocketClient, socket: TestSocket): void {
	const handler = Reflect.get(client, "handleSocketOpen") as (socket: TestSocket) => void;
	handler.call(client, socket);
}

function handleSocketMessage(client: WebSocketClient, socket: TestSocket, packet: unknown): void {
	const handler = Reflect.get(client, "handleSocketMessage") as (socket: TestSocket, event: MessageEvent) => void;
	handler.call(client, socket, {data: JSON.stringify([packet])} as MessageEvent);
}

function queuedPackets(client: WebSocketClient): unknown[] {
	return Reflect.get(client, "packetQueue") as unknown[];
}

describe("WebSocketClient", () => {
	it("correlates a response with the request packet id", () => {
		const {client, socket} = clientWithSocket();
		const responseHandler = jest.fn();

		client.sendPacket(new TestRequest(), {
			[TestResponse.wireName]: responseHandler as never
		});

		const sentPacket = JSON.parse(socket.send.mock.calls[0][0] as string) as {id: string; name: string};
		expect(sentPacket.name).toBe(TestRequest.wireName);
		expect(sentPacket.name).not.toBe(TestRequest.name);
		handleIncomingPacket(client, {
			id: sentPacket.id,
			name: TestResponse.wireName,
			packet: {value: "ok"}
		});

		expect(responseHandler).toHaveBeenCalledWith({value: "ok"});
	});

	it("dispatches a correlated response to pushed consumers as well", () => {
		const {client, socket} = clientWithSocket();
		const responseHandler = jest.fn();
		const pushedHandler = jest.fn();
		const unregister = client.registerPushedPacketHandler(TestResponse.wireName, pushedHandler);

		client.sendPacket(new TestRequest(), {
			[TestResponse.wireName]: responseHandler as never
		});

		const sentPacket = JSON.parse(socket.send.mock.calls[0][0] as string) as {id: string};
		handleIncomingPacket(client, {
			id: sentPacket.id,
			name: TestResponse.wireName,
			packet: {value: "ok"}
		});

		expect(responseHandler).toHaveBeenCalledWith({value: "ok"});
		expect(pushedHandler).toHaveBeenCalledWith({value: "ok"}, {answersRequest: true});
		unregister();
	});

	it("dispatches a pushed packet to a registered consumer", () => {
		const {client} = clientWithSocket();
		const pushedHandler = jest.fn();
		const unregister = client.registerPushedPacketHandler("PushedPacket", pushedHandler);

		handleIncomingPacket(client, {
			name: "PushedPacket",
			packet: {value: "hello"}
		});

		expect(pushedHandler).toHaveBeenCalledWith({value: "hello"}, {answersRequest: false});
		unregister();
	});

	it("keeps a queued request correlated when the socket reconnects", () => {
		const warnSpy = jest.spyOn(console, "warn").mockImplementation();
		const {client, socket} = clientWithSocket({
			readyState: 0,
			send: jest.fn(),
			close: jest.fn()
		});
		const request = new TestRequest();
		const responseHandler = jest.fn();

		client.sendPacket(request, {[TestResponse.wireName]: responseHandler as never});

		const [queuedPacket] = queuedPackets(client) as {id: string; packet: TestRequest}[];
		expect(queuedPacket.packet).toBe(request);
		expect(queuedPacket.id).toEqual(expect.any(String));

		socket.readyState = OPEN_STATE;
		handleSocketOpen(client, socket);

		const sentPacket = JSON.parse(socket.send.mock.calls[0][0] as string) as {id: string};
		expect(sentPacket.id).toBe(queuedPacket.id);
		handleIncomingPacket(client, {
			id: sentPacket.id,
			name: TestResponse.wireName,
			packet: {value: "reconnected"}
		});

		expect(responseHandler).toHaveBeenCalledWith({value: "reconnected"});
		warnSpy.mockRestore();
	});

	it("does not send an expired request after a prolonged disconnection", () => {
		jest.useFakeTimers();
		const warnSpy = jest.spyOn(console, "warn").mockImplementation();
		try {
			const {client, socket} = clientWithSocket({readyState: 0, send: jest.fn(), close: jest.fn()});
			const timeoutCallback = jest.fn();
			client.sendPacket(new TestRequest(), {[TestResponse.wireName]: jest.fn() as never}, {time: 1000, callback: timeoutCallback});
			jest.advanceTimersByTime(60_000);
			socket.readyState = OPEN_STATE;
			handleSocketOpen(client, socket);
			handleSocketOpen(client, socket);
			expect(timeoutCallback).toHaveBeenCalledTimes(1);
			expect(socket.send).not.toHaveBeenCalled();
			expect(queuedPackets(client)).toEqual([]);
		}
		finally {
			warnSpy.mockRestore();
			jest.useRealTimers();
		}
	});

	it("never replays a sent request when the connection opens again without its response", () => {
		const {client, socket} = clientWithSocket();
		client.sendPacket(new TestRequest(), {[TestResponse.wireName]: jest.fn() as never});
		handleSocketOpen(client, socket);
		handleSocketOpen(client, socket);
		expect(socket.send).toHaveBeenCalledTimes(1);
		expect(queuedPackets(client)).toEqual([]);
	});

	it("expires even uncorrelated packets when resuming with suspended timers", () => {
		jest.useFakeTimers();
		try {
			const {client, socket} = clientWithSocket({readyState: 0, send: jest.fn(), close: jest.fn()});
			client.sendPacket(new TestRequest(), {});
			jest.setSystemTime(Date.now() + 60_000);
			socket.readyState = OPEN_STATE;
			handleSocketOpen(client, socket);
			expect(socket.send).not.toHaveBeenCalled();
			expect(queuedPackets(client)).toEqual([]);
		}
		finally {
			jest.useRealTimers();
		}
	});

	it("recovers from a socket error and sends the queued request once on the new connection", async () => {
		jest.useFakeTimers();
		const {client, socket} = clientWithSocket();
		const onStateChange = jest.fn();
		const responseHandler = jest.fn();
		Reflect.set(client, "setState", onStateChange);
		const replacementSocket = {readyState: 0, send: jest.fn(), close: jest.fn()};
		const originalSocket = globalThis.WebSocket;
		const originalUrl = process.env.EXPO_PUBLIC_WEBSOCKET_URL;
		const socketConstructor = jest.fn(() => replacementSocket);
		Object.assign(socketConstructor, {OPEN: OPEN_STATE, CONNECTING: 0});
		Reflect.set(globalThis, "WebSocket", socketConstructor);
		process.env.EXPO_PUBLIC_WEBSOCKET_URL = "ws://local-test";
		try {
			const token = new AuthToken({accessToken: "local-test", refreshToken: "local-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"});
			Reflect.get(client, "handleSocketError").call(client, socket, {});
			Reflect.get(client, "handleSocketClose").call(client, socket, {reason: ""}, token, false);
			client.sendPacket(new TestRequest(), {[TestResponse.wireName]: responseHandler as never});
			await jest.advanceTimersByTimeAsync(1000);
			replacementSocket.readyState = OPEN_STATE;
			Reflect.get(replacementSocket, "onopen")();
			handleSocketOpen(client, replacementSocket);
			const sentPacket = JSON.parse(replacementSocket.send.mock.calls[0][0] as string) as {id: string};
			handleSocketMessage(client, replacementSocket, {id: sentPacket.id, name: TestResponse.wireName, packet: {value: "recovered"}});
			expect(socket.close).toHaveBeenCalledTimes(1);
			expect(replacementSocket.send).toHaveBeenCalledTimes(1);
			expect(responseHandler).toHaveBeenCalledWith({value: "recovered"});
			expect(onStateChange).not.toHaveBeenCalledWith(AuthStateEnum.CONNECTION_ERROR);
			expect(onStateChange).toHaveBeenLastCalledWith(AuthStateEnum.LOGGED_IN);
		}
		finally {
			client.disconnect();
			Reflect.set(globalThis, "WebSocket", originalSocket);
			if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_WEBSOCKET_URL;
			else process.env.EXPO_PUBLIC_WEBSOCKET_URL = originalUrl;
			jest.useRealTimers();
		}
	});

	it("drops the previous session socket and pending requests on disconnect", () => {
		const warnSpy = jest.spyOn(console, "warn").mockImplementation();
		const {client, socket} = clientWithSocket({
			readyState: 0,
			send: jest.fn(),
			close: jest.fn()
		});
		client.sendPacket(new TestRequest(), {[TestResponse.wireName]: jest.fn() as never});

		client.disconnect();

		expect(socket.close).toHaveBeenCalledTimes(1);
		expect(Reflect.get(client, "socket")).toBeNull();
		expect(queuedPackets(client)).toEqual([]);
		expect(Reflect.get(client, "responseHandlers").size).toBe(0);
		warnSpy.mockRestore();
	});

	it("ignores a packet arriving from the previous session socket", () => {
		const {client, socket} = clientWithSocket();
		const pushedHandler = jest.fn();
		const unregister = client.registerPushedPacketHandler("PushedPacket", pushedHandler);
		client.disconnect();

		handleSocketMessage(client, socket, {name: "PushedPacket", packet: {value: "stale"}});

		expect(pushedHandler).not.toHaveBeenCalled();
		unregister();
	});

	it("does not reclaim the session after another client replaces it", () => {
		jest.useFakeTimers();
		try {
			const {client, socket} = clientWithSocket();
			const onStateChange = jest.fn();
			Reflect.set(client, "setState", onStateChange);
			const token = new AuthToken({accessToken: "local-test", refreshToken: "local-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"});
			const handleClose = Reflect.get(client, "handleSocketClose");

			handleClose.call(client, socket, {reason: WEBSOCKET_SESSION_REPLACED_REASON}, token, false);
			jest.runOnlyPendingTimers();

			expect(onStateChange).toHaveBeenCalledTimes(1);
			expect(onStateChange).toHaveBeenCalledWith(AuthStateEnum.CONNECTION_ERROR);
			expect(Reflect.get(client, "reconnectTimeoutId")).toBeNull();
			expect(Reflect.get(client, "socket")).toBeNull();
			expect(queuedPackets(client)).toEqual([]);
		}
		finally {
			jest.useRealTimers();
		}
	});

	it("does not save or reconnect the old account after its refresh finishes during an account switch", async () => {
		jest.useFakeTimers();
		const {client} = clientWithSocket();
		client.disconnect();
		const originalSocket = globalThis.WebSocket;
		const originalUrl = process.env.EXPO_PUBLIC_WEBSOCKET_URL;
		const socket = {readyState: 0, send: jest.fn(), close: jest.fn()};
		const socketConstructor = jest.fn(() => socket);
		Object.assign(socketConstructor, {OPEN: OPEN_STATE, CONNECTING: 0});
		Reflect.set(globalThis, "WebSocket", socketConstructor);
		process.env.EXPO_PUBLIC_WEBSOCKET_URL = "ws://local-test";
		try {
			const previous = new AuthToken({accessToken: "old-account", refreshToken: "old-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"});
			const current = new AuthToken({accessToken: "new-account", refreshToken: "new-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"});
			let finishRefresh!: (refreshed: boolean) => void;
			jest.spyOn(previous, "refreshIfNeeded").mockReturnValueOnce(new Promise<boolean>(resolve => { finishRefresh = resolve; }));
			const previousState = jest.fn();
			const savePrevious = jest.fn().mockResolvedValue(undefined);
			const pending = client.init(previous, previousState, savePrevious);
			client.disconnect();
			await client.init(current, jest.fn(), jest.fn().mockResolvedValue(undefined));
			finishRefresh(true);
			await pending;
			expect(socketConstructor).toHaveBeenCalledTimes(1);
			expect(socketConstructor).toHaveBeenCalledWith(expect.stringContaining("token=new-account"));
			expect(savePrevious).not.toHaveBeenCalled();
			expect(Reflect.get(client, "socket")).toBe(socket);
		}
		finally {
			client.disconnect();
			Reflect.set(globalThis, "WebSocket", originalSocket);
			if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_WEBSOCKET_URL;
			else process.env.EXPO_PUBLIC_WEBSOCKET_URL = originalUrl;
			jest.useRealTimers();
		}
	});
});
