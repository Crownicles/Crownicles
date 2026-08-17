import type {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {PushedPacketRegistry} from "@/src/networking/PushedPacketRegistry";

type TestPushedPacket = FromServerPacket & { value: string };

describe("PushedPacketRegistry", () => {
	it("dispatches a pushed packet to every registered consumer", () => {
		const registry = new PushedPacketRegistry();
		const firstHandler = jest.fn();
		const secondHandler = jest.fn();
		const packet = {value: "hello"} as TestPushedPacket;

		const unregisterFirst = registry.register("TestPushedPacket", firstHandler);
		registry.register("TestPushedPacket", secondHandler);

		expect(registry.dispatch("TestPushedPacket", packet)).toBe(true);
		expect(firstHandler).toHaveBeenCalledWith(packet);
		expect(secondHandler).toHaveBeenCalledWith(packet);

		unregisterFirst();
		registry.dispatch("TestPushedPacket", packet);

		expect(firstHandler).toHaveBeenCalledTimes(1);
		expect(secondHandler).toHaveBeenCalledTimes(2);
	});

	it("reports an unhandled packet only once", () => {
		const registry = new PushedPacketRegistry();
		const warnSpy = jest.spyOn(console, "warn").mockImplementation();
		const packet = {} as TestPushedPacket;

		try {
			expect(registry.dispatch("UnknownPacket", packet)).toBe(false);
			registry.reportUnhandled("UnknownPacket");
			registry.reportUnhandled("UnknownPacket");

			expect(warnSpy).toHaveBeenCalledTimes(1);
			expect(warnSpy).toHaveBeenCalledWith("No pushed packet handler registered for UnknownPacket");
		}
		finally {
			warnSpy.mockRestore();
		}
	});
});