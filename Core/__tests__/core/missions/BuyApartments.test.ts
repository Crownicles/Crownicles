import {
	describe, expect, it, vi
} from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/buyApartments";
import { Apartments } from "../../../src/core/database/game/models/Apartment";

describe("buyApartments mission", () => {
	it("should initialize progression with the number of owned apartments", async () => {
		const apartments = Array.from({ length: 5 }, () => ({} as never));
		vi.spyOn(Apartments, "getOfPlayer").mockResolvedValue(apartments);

		await expect(missionInterface.initialNumberDone({ id: 42 } as never, 0)).resolves.toBe(5);
	});
});
