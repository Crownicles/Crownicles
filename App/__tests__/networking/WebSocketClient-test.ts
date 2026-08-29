import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";

class TestRequest extends FromClientPacket {}
class TestResponse extends FromServerPacket {
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

function handleSocketOpen(client: WebSocketClient): void {
	const handler = Reflect.get(client, "handleSocketOpen") as () => void;
	handler.call(client);
}

function queuedPackets(client: WebSocketClient): unknown[] {
	return Reflect.get(client, "packetQueue") as unknown[];
}

describe("WebSocketClient", () => {
	it("correlates a response with the request packet id", () => {
		const {client, socket} = clientWithSocket();
		const responseHandler = jest.fn();

		client.sendPacket(new TestRequest(), {
			[TestResponse.name]: responseHandler as never
		});

		const sentPacket = JSON.parse(socket.send.mock.calls[0][0] as string) as {id: string; name: string};
		expect(sentPacket.name).toBe(TestRequest.name);
		handleIncomingPacket(client, {
			id: sentPacket.id,
			name: TestResponse.name,
			packet: {value: "ok"}
		});

		expect(responseHandler).toHaveBeenCalledWith({value: "ok"});
	});

	it("dispatches a correlated response to pushed consumers as well", () => {
		const {client, socket} = clientWithSocket();
		const responseHandler = jest.fn();
		const pushedHandler = jest.fn();
		const unregister = client.registerPushedPacketHandler(TestResponse.name, pushedHandler);

		client.sendPacket(new TestRequest(), {
			[TestResponse.name]: responseHandler as never
		});

		const sentPacket = JSON.parse(socket.send.mock.calls[0][0] as string) as {id: string};
		handleIncomingPacket(client, {
			id: sentPacket.id,
			name: TestResponse.name,
			packet: {value: "ok"}
		});

		expect(responseHandler).toHaveBeenCalledWith({value: "ok"});
		expect(pushedHandler).toHaveBeenCalledWith({value: "ok"});
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

		expect(pushedHandler).toHaveBeenCalledWith({value: "hello"});
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

		client.sendPacket(request, {[TestResponse.name]: responseHandler as never});

		const [queuedPacket] = queuedPackets(client) as {id: string; packet: TestRequest}[];
		expect(queuedPacket.packet).toBe(request);
		expect(queuedPacket.id).toEqual(expect.any(String));

		socket.readyState = OPEN_STATE;
		handleSocketOpen(client);

		const sentPacket = JSON.parse(socket.send.mock.calls[0][0] as string) as {id: string};
		expect(sentPacket.id).toBe(queuedPacket.id);
		handleIncomingPacket(client, {
			id: sentPacket.id,
			name: TestResponse.name,
			packet: {value: "reconnected"}
		});

		expect(responseHandler).toHaveBeenCalledWith({value: "reconnected"});
		warnSpy.mockRestore();
	});
});
