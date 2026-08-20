import {
	afterAll,
	beforeAll,
	describe,
	expect,
	it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment,
	loadProductionModule,
	pinInertDailyMission,
	runAllOrThrow,
	setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { InventorySlot as InventorySlotType } from "../../src/core/database/game/models/InventorySlot";
import type { Material as MaterialType } from "../../src/core/database/game/models/Material";
import type { ReactionCollectorCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ItemCategory, ItemConstants } from "../../../Lib/src/constants/ItemConstants";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportScrapDealerRecycleRes } from "../../../Lib/src/packets/commands/CommandReportPacket";

type ScrapDealerModule = typeof import("../../src/core/report/ReportCityScrapDealerService");
type PlayerModule = typeof import("../../src/core/database/game/models/Player");
type InventoryModule = typeof import("../../src/core/database/game/models/InventorySlot");
type ReactionModule = typeof import("../../../Lib/src/packets/interaction/ReactionCollectorCity");

const N_CONCURRENT = 20;

describe("scrap dealer race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let Material: ModelStatic<MaterialType>;
	let scrapDealerMod: ScrapDealerModule;
	let playerMod: PlayerModule;
	let inventoryMod: InventoryModule;
	let reactionMod: ReactionModule;

	beforeAll(async () => {
		env = await setupCoreForTests("scrap_dealer_race");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		InventorySlot = env.crownicles.gameDatabase.sequelize.models.InventorySlot as ModelStatic<InventorySlotType>;
		Material = env.crownicles.gameDatabase.sequelize.models.Material as ModelStatic<MaterialType>;
		scrapDealerMod = loadProductionModule<ScrapDealerModule>("core/report/ReportCityScrapDealerService");
		playerMod = loadProductionModule<PlayerModule>("core/database/game/models/Player");
		inventoryMod = loadProductionModule<InventoryModule>("core/database/game/models/InventorySlot");
		reactionMod = loadProductionModule<ReactionModule>("../../Lib/src/packets/interaction/ReactionCollectorCity");
		await pinInertDailyMission(env);
	});

	afterAll(async () => {
		await env?.teardown();
	});

	it(`recycles the same equipment only once across ${N_CONCURRENT} concurrent reactions`, async () => {
		const player = await Player.create({
			keycloakId: "race-scrap-dealer",
			money: 0
		});
		await inventoryMod.InventorySlots.getOfPlayer(player.id);
		await InventorySlot.create({
			playerId: player.id,
			slot: 1,
			itemCategory: ItemCategory.WEAPON,
			itemId: 1,
			itemLevel: ItemConstants.MAX_UPGRADE_LEVEL,
			itemEnchantmentId: null
		});

		const reportPlayer = await playerMod.Player.findByPk(player.id);
		expect(reportPlayer).toBeTruthy();
		const inventory = await inventoryMod.InventorySlots.getOfPlayer(player.id);
		const scrapDealer = scrapDealerMod.buildScrapDealerData(inventory, reportPlayer!);
		const listedItem = scrapDealer.recyclableItems.find(item => item.slot === 1 && item.category === ItemCategory.WEAPON);
		expect(listedItem).toBeTruthy();

		const data = { scrapDealer } as ReactionCollectorCityData;
		const reaction = new reactionMod.ReactionCollectorScrapDealerRecycleReaction();
		reaction.slot = listedItem!.slot;
		reaction.itemCategory = listedItem!.category;
		reaction.itemId = listedItem!.itemId;
		const responses: CrowniclesPacket[][] = [];

		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, async () => {
				const stalePlayer = await playerMod.Player.findByPk(player.id);
				const response: CrowniclesPacket[] = [];
				responses.push(response);
				await scrapDealerMod.handleScrapDealerRecycleReaction(
					stalePlayer!,
					reaction,
					data,
					response
				);
			})
		);

		expect(await InventorySlot.count({
			where: {
				playerId: player.id,
				slot: listedItem!.slot,
				itemCategory: listedItem!.category
			}
		})).toBe(0);
		expect(responses.filter(response => response.length > 0)).toHaveLength(1);
		expect(responses.flat().filter(packet => packet.constructor.name === CommandReportScrapDealerRecycleRes.name)).toHaveLength(1);

		const materialRows = await Material.findAll({ where: { playerId: player.id } });
		expect(new Map(materialRows.map(row => [row.materialId, row.quantity]))).toEqual(
			new Map(listedItem!.recoveredMaterials.map(material => [material.materialId, material.quantity]))
		);
	});
});
