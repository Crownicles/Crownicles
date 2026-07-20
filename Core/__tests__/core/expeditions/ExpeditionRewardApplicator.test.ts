import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { applyExpeditionRewards } from "../../../src/core/expeditions/ExpeditionRewardApplicator";
import Player from "../../../src/core/database/game/models/Player";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../../../src/core/utils/MaterialLootUtils";

vi.mock("../../../src/core/utils/ItemUtils", () => ({
	getItemByIdAndCategory: vi.fn(() => undefined),
	giveItemToPlayer: vi.fn()
}));

vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({
	applyMaterialLoot: vi.fn(),
	updateCollectMaterialsMission: vi.fn()
}));

describe("ExpeditionRewardApplicator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should update the collect materials mission with expedition loot", async () => {
		const player = { id: 42 } as Player;
		const response = [];
		const materialLoot = [{
			materialId: MaterialRarity.COMMON,
			quantity: 3
		}];

		await applyExpeditionRewards({
			money: 0,
			experience: 0,
			points: 0,
			itemId: 0,
			itemCategory: 0,
			materialLoot
		}, player, response, {} as PacketContext);

		expect(applyMaterialLoot).toHaveBeenCalledWith(player.id, materialLoot);
		expect(updateCollectMaterialsMission).toHaveBeenCalledWith(player, response, materialLoot);
	});
});
