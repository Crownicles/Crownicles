import {GameClient} from "@/src/networking/GameClient";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {AppConstants} from "@/src/AppConstants";
import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";

class TestRequest extends FromClientPacket {}
class TestResponse extends FromServerPacket {
	value!: string;
}
class TestAlternative extends FromServerPacket {}

describe("GameClient", () => {
	beforeEach(() => {
		jest.restoreAllMocks();
	});

	it("resolves the expected answer", async () => {
		const request = new TestRequest();
		const sendPacket = jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation((_packet, handlers) => {
			handlers[TestResponse.name]({value: "ok"} as never);
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
			handlers[TestAlternative.name]({} as never);
		});

		await expect(GameClient.request(new TestRequest(), TestResponse, [TestAlternative])).resolves.toEqual({
			kind: "alternative",
			packetName: TestAlternative.name
		});
	});

	it("resolves a timeout when no answer arrives", async () => {
		jest.spyOn(WebSocketClient.getInstance(), "sendPacket").mockImplementation((_packet, _handlers, timeout) => {
			timeout?.callback?.();
		});

		await expect(GameClient.request(new TestRequest(), TestResponse)).resolves.toEqual({kind: "timeout"});
	});
});
