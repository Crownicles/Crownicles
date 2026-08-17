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

	it("queues a packet while the socket is unavailable", () => {
		const warnSpy = jest.spyOn(console, "warn").mockImplementation();
		const {client} = clientWithSocket({
			readyState: 0,
			send: jest.fn(),
			close: jest.fn()
		});
		const request = new TestRequest();

		client.sendPacket(request, {});

		expect(queuedPackets(client)).toEqual([{packet: request}]);
		warnSpy.mockRestore();
	});
});
