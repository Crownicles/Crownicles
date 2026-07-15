import {
	describe, expect, it, vi
} from "vitest";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorStopPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import { runWithDeferredCollectorStop } from "../../../src/core/report/ReportCityShopHandoff";

describe("city shop collector handoff", () => {
	it("places the city stop packet after the shop creation packet", async () => {
		const stopPacket = makePacket(ReactionCollectorStopPacket, { id: "city-collector" });
		const shopPacket = makePacket(ReactionCollectorCreationPacket, {} as ReactionCollectorCreationPacket);
		const response = [stopPacket];

		await runWithDeferredCollectorStop(response, "city-collector", () => {
			response.push(shopPacket);
			return Promise.resolve();
		});

		expect(response).toEqual([shopPacket, stopPacket]);
	});

	it("restores the stop packet when shop creation fails", async () => {
		const stopPacket = makePacket(ReactionCollectorStopPacket, { id: "city-collector" });
		const response = [stopPacket];
		const error = new Error("shop creation failed");

		await expect(runWithDeferredCollectorStop(response, "city-collector", () => Promise.reject(error))).rejects.toBe(error);

		expect(response).toEqual([stopPacket]);
	});

	it("runs normally when no stop packet is present", async () => {
		const response = [];
		const openShop = vi.fn().mockResolvedValue(undefined);

		await runWithDeferredCollectorStop(response, "city-collector", openShop);

		expect(openShop).toHaveBeenCalledOnce();
		expect(response).toEqual([]);
	});

	it("leaves unrelated stop packets in place", async () => {
		const unrelatedStopPacket = makePacket(ReactionCollectorStopPacket, { id: "other-collector" });
		const shopPacket = makePacket(ReactionCollectorCreationPacket, {} as ReactionCollectorCreationPacket);
		const response = [unrelatedStopPacket];

		await runWithDeferredCollectorStop(response, "city-collector", () => {
			response.push(shopPacket);
			return Promise.resolve();
		});

		expect(response).toEqual([unrelatedStopPacket, shopPacket]);
	});
});