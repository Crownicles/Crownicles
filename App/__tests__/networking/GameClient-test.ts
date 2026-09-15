import {GameClient} from "@/src/networking/GameClient";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AppConstants} from "@/src/AppConstants";
import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {CommandRejected} from "ws-packets/src/fromServer/common/CommandRejected";

class TestRequest extends FromClientPacket {
	static readonly wireName = "TestRequest";
}
class TestResponse extends FromServerPacket {
	static readonly wireName = "TestResponse";

	value!: string;
}
class TestAlternative extends FromServerPacket {
	static readonly wireName = "TestAlternative";
}

describe("GameClient", () => {
	beforeEach(() => {
		jest.restoreAllMocks();
	});

	it("resolves the expected answer", async () => {
		const request = new TestRequest();
		const sendPacket = jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation((_packet, handlers) => {
			handlers[TestResponse.wireName]({value: "ok"} as never);
		});

		await expect(GameClient.request(request, TestResponse)).resolves.toEqual({
			kind: "answer",
			packet: {value: "ok"}
		});
		expect(sendPacket).toHaveBeenCalledWith(request, expect.any(Object), expect.objectContaining({
			time: AppConstants.PACKET_TIMEOUT
		}));
	});

	it("turns a legitimate alternative response into an empty answer", async () => {
		jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation((_packet, handlers) => {
			handlers[TestAlternative.wireName]({} as never);
		});

		await expect(GameClient.request(new TestRequest(), TestResponse, [TestAlternative])).resolves.toEqual({
			kind: "alternative",
			packetName: TestAlternative.wireName
		});
	});

	it("resolves a timeout when no answer arrives", async () => {
		jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation((_packet, _handlers, timeout) => {
			timeout?.callback?.();
		});

		await expect(GameClient.request(new TestRequest(), TestResponse)).resolves.toEqual({kind: "timeout"});
	});

	it("returns a typed server refusal without waiting for a timeout", async () => {
		jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation((_packet, handlers) => {
			handlers[CommandRejected.wireName]({rejection: {type: "level", requiredLevel: 10}} as never);
		});
		await expect(GameClient.request(new TestRequest(), TestResponse)).resolves.toEqual({kind: "rejected", packet: {rejection: {type: "level", requiredLevel: 10}}});
	});
});
