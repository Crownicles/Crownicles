import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import {
	readdirSync, readFileSync
} from "fs";
import { resolve } from "path";

vi.mock("../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logClassicalShopBuyout: vi.fn() } }
}));

vi.mock("../../../src/core/utils/ShopUtils", () => ({
	ShopUtils: { createAndSendShopCollector: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/database/game/models/Material", () => ({
	Materials: { giveMaterial: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

import {
	openLumberjack, openMaterialMerchant
} from "../../../src/core/report/ReportCityShopService";
import { ShopUtils } from "../../../src/core/utils/ShopUtils";
import { Materials } from "../../../src/core/database/game/models/Material";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import type { Player } from "../../../src/core/database/game/models/Player";
import type { City } from "../../../src/data/City";
import type { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import type { ShopCategory } from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";

type ShopOpener = typeof openLumberjack;

const player = {
	id: 1,
	keycloakId: "collect-materials"
} as Player;
const BOUGHT_AMOUNT = 10;

async function buy(openShop: ShopOpener, shopItemId: ShopItemType): Promise<void> {
	await openShop({
		player,
		city: { id: "city" } as City,
		context: {} as PacketContext,
		response: [],
		onClose: vi.fn()
	});
	const [, , { shopCategories }] = vi.mocked(ShopUtils.createAndSendShopCollector).mock.calls[0] as [unknown, unknown, { shopCategories: ShopCategory[] }];
	const item = shopCategories.flatMap(category => category.items).find(shopItem => shopItem.id === shopItemId)!;
	await item.buyCallback([], player.id, {} as PacketContext, BOUGHT_AMOUNT);
}

function getCollectMaterialsUpdates(): {
	count: number;
	rarity: MaterialRarity;
}[] {
	return vi.mocked(MissionsController.update).mock.calls
		.filter(([, , mission]) => mission.missionId === "collectMaterials")
		.map(([, , mission]) => ({
			count: mission.count as number,
			rarity: mission.params!.rarity as MaterialRarity
		}));
}

/**
 * Regression tests for issue #4856: every way of obtaining materials must progress the collectMaterials mission.
 */
describe("collectMaterials mission sources (#4856)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("counts uncommon wood bought from the lumberjack", async () => {
		await buy(openLumberjack, ShopItemType.WOOD_UNCOMMON_BUNDLE);

		expect(getCollectMaterialsUpdates()).toEqual([{ count: BOUGHT_AMOUNT, rarity: MaterialRarity.UNCOMMON }]);
	});

	it("counts every material of a material merchant pack", async () => {
		await buy(openMaterialMerchant, ShopItemType.RANDOM_MATERIAL_PACK);

		const givenQuantity = vi.mocked(Materials.giveMaterial).mock.calls.reduce((total, [, , quantity]) => total + quantity, 0);
		const countedQuantity = getCollectMaterialsUpdates().reduce((total, update) => total + update.count, 0);
		expect(givenQuantity).toBe(BOUGHT_AMOUNT);
		expect(countedQuantity).toBe(BOUGHT_AMOUNT);
	});

	it("updates the mission in every source file granting materials", () => {
		const sourceRoot = resolve(__dirname, "../../../src");
		const exempted = [
			"core/utils/MaterialLootUtils.ts",
			"commands/admin/testCommands/Home/GiveMaterialTestCommand.ts"
		];
		const listSources = (directory: string): string[] => readdirSync(resolve(sourceRoot, directory), { withFileTypes: true })
			.flatMap(entry => entry.isDirectory()
				? listSources(`${directory}${entry.name}/`)
				: entry.name.endsWith(".ts") ? [`${directory}${entry.name}`] : []);

		const missingMissionUpdate = listSources("")
			.filter(file => !exempted.includes(file))
			.filter(file => {
				const source = readFileSync(resolve(sourceRoot, file), "utf-8");
				return /Materials\.giveMaterial\(|applyMaterialLoot\(/u.test(source) && !source.includes("updateCollectMaterialsMission(");
			});

		expect(missingMissionUpdate).toEqual([]);
	});
});
