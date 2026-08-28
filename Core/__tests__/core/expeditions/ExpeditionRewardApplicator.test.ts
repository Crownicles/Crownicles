import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { applyExpeditionRewards } from "../../../src/core/expeditions/ExpeditionRewardApplicator";
import Player from "../../../src/core/database/game/models/Player";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../../../src/core/utils/MaterialLootUtils";
import { MissionsController } from "../../../src/core/missions/MissionsController";

vi.mock("../../../src/core/utils/ItemUtils", () => ({
	getItemByIdAndCategory: vi.fn(() => undefined),
	giveItemToPlayer: vi.fn()
}));

vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({
	applyMaterialLoot: vi.fn(),
	updateCollectMaterialsMission: vi.fn()
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: {
		update: vi.fn()
	}
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

	it("keeps the actual token reward in the response when it crosses the cap", async () => {
		const response = [];
		const player = {
			id: 42,
			tokens: 20,
			addTokensAndGetActualGain: vi.fn().mockResolvedValue(3)
		} as unknown as Player;
		const rewards = {
			money: 0,
			experience: 0,
			points: 0,
			tokens: 3,
			itemId: 0,
			itemCategory: 0
		};

		await applyExpeditionRewards(rewards, player, response, {} as PacketContext);

		expect(player.addTokensAndGetActualGain).toHaveBeenCalledWith({
			amount: 3,
			response,
			reason: NumberChangeReason.EXPEDITION
		});
		expect(rewards.tokens).toBe(3);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, {
			missionId: "earnTokensInOneExpedition",
			count: 3,
			set: true
		});
	});
});
