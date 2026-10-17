import {
	describe, expect, it, vi
} from "vitest";
import { QueryInterface } from "sequelize";
import { up } from "../../../src/core/database/game/migrations/065-fix-v5-completed-campaign-slot";

describe("065-fix-v5-completed-campaign-slot migration", () => {
	it("resynchronizes only the stale completed V5 campaign slot", async () => {
		const query = vi.fn().mockResolvedValue(undefined);
		const context = {
			sequelize: { query }
		} as unknown as QueryInterface;

		await up({ context });

		expect(query).toHaveBeenCalledOnce();
		const sql = query.mock.calls[0][0] as string;
		expect(sql).toContain("SET pmi.campaignProgression = 10");
		expect(sql).toContain("ms.missionId = 'commandMap'");
		expect(sql).toContain("ms.numberDone = 0");
		expect(sql).toContain("pmi.campaignProgression = 12");
		expect(sql).toContain("SUBSTRING(pmi.campaignBlob, 10, 3) = '010'");
		expect(sql).toContain("ms.missionId = 'depositPetInShelter'");
		expect(sql).toContain("ms.numberDone = 1");
	});
});
