import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/PlayerBadges", () => ({
	PlayerBadgesManager: {
		hasBadge: vi.fn(),
		addBadge: vi.fn()
	}
}));

import { PlayerBadgesManager } from "../../../src/core/database/game/models/PlayerBadges";
import { getQuestMasterBadgeShopItem } from "../../../src/core/utils/MissionManagerShopItems";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";

describe("quest master badge shop item", () => {
	it("is not displayed when the player already owns the badge", async () => {
		vi.mocked(PlayerBadgesManager.hasBadge).mockResolvedValue(true);

		await expect(getQuestMasterBadgeShopItem(1)).resolves.toBeNull();
	});

	it("is displayed when the player does not own the badge", async () => {
		vi.mocked(PlayerBadgesManager.hasBadge).mockResolvedValue(false);

		const item = await getQuestMasterBadgeShopItem(1);

		expect(item?.id).toBe(ShopItemType.QUEST_MASTER_BADGE);
	});
});
