import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn()
	}
}));
vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logEnchanterUse: vi.fn().mockResolvedValue(undefined),
			logEnchanterDisenchant: vi.fn().mockResolvedValue(undefined)
		}
	}
}));
vi.mock("../../../src/core/database/game/models/Setting", () => ({
	Settings: { ENCHANTER_ENCHANTMENT_ID: { getValue: vi.fn() } }
}));
vi.mock("../../../src/core/database/game/models/InventorySlot", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/InventorySlot")>(),
	InventorySlots: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/PlayerMissionsInfo")>(),
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/DailyMission", () => ({
	DailyMissions: { getOrGenerate: vi.fn() }
}));
vi.mock("../../../../Lib/src/locks/withLockedEntities", () => ({
	withLockedEntities: vi.fn()
}));
vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

import {
	handleEnchanterDisenchantReaction, handleEnchantReaction
} from "../../../src/core/report/ReportCityEnchanterService";
import { buildEnchanterData } from "../../../src/core/report/ReportCityService";
import { Settings } from "../../../src/core/database/game/models/Setting";
import InventorySlot, { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { Player } from "../../../src/core/database/game/models/Player";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { crowniclesInstance } from "../../../src/app";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { makeInventorySlot } from "./CityPlayerFixture";
import {
	asPlayer, CityHandlerPlayer, describePackets, lockedEntitiesOf, makeHandlerPlayer
} from "./CityHandlerFixture";

// Enchantment of probability weight 7: 2500 coins and 3 gems, 2000 coins and 2 gems for a mage
const ENCHANTMENT = ItemEnchantment.PVE_ATTACK_1;
const MONEY_PRICE = 2500;
const GEMS_PRICE = 3;
const MAGE_MONEY_PRICE = 2000;
const MAGE_GEMS_PRICE = 2;
const COMMON_WEAPON_ID = 2;
const COMMON_ARMOR_ID = 2;

const logs = crowniclesInstance?.logsDatabase;

type Slot = InventorySlot & { save: ReturnType<typeof vi.fn> };

type LockedMissionsInfo = {
	playerId: number;
	gems: number;
	spendGems: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
};

function weapon(itemEnchantmentId: string | null = null): Slot {
	return Object.assign(makeInventorySlot({
		slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID, itemEnchantmentId
	}), { save: vi.fn().mockResolvedValue(undefined) });
}

function makeMissionsInfo(gems: number): LockedMissionsInfo {
	const missionsInfo: LockedMissionsInfo = {
		playerId: 1,
		gems,
		spendGems: vi.fn((amount: number) => {
			missionsInfo.gems -= amount;
			return Promise.resolve();
		}),
		save: vi.fn().mockResolvedValue(undefined)
	};
	return missionsInfo;
}

function lockRows(player: CityHandlerPlayer, missionsInfo: LockedMissionsInfo, ...slots: Slot[]): void {
	const resolve = lockedEntitiesOf([[Player, player.id, player], [PlayerMissionsInfo, player.id, missionsInfo]]);
	vi.mocked(withLockedEntities).mockImplementation((keys, callback) => callback(resolve(keys) as never));
	vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue(slots);
}

async function openEnchanter(player: CityHandlerPlayer, slots: Slot[], enchantment = ENCHANTMENT): Promise<ReactionCollectorCityData> {
	vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({ gems: 0 } as PlayerMissionsInfo);

	// The enchanter handlers only read the enchanter part of the city data
	return {
		enchanter: await buildEnchanterData({
			inventory: slots, player: asPlayer(player)
		}, {
			enchantment, enchantmentId: enchantment.id, isPlayerMage: player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE
		})
	} as ReactionCollectorCityData;
}

async function enchant(player: CityHandlerPlayer, data: ReactionCollectorCityData, itemCategory = ItemCategory.WEAPON): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await handleEnchantReaction(asPlayer(player), {
		slot: 0, itemCategory
	}, data, response);
	return response;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(Settings.ENCHANTER_ENCHANTMENT_ID.getValue).mockResolvedValue(ENCHANTMENT.id);
});

describe("handleEnchantReaction", () => {
	it("enchants the listed equipment and debits the listed money and gems", async () => {
		const player = makeHandlerPlayer(MONEY_PRICE);
		const missionsInfo = makeMissionsInfo(GEMS_PRICE);
		const slot = weapon();
		const data = await openEnchanter(player, [slot]);
		lockRows(player, missionsInfo, slot);

		const response = await enchant(player, data);

		expect(data.enchanter?.enchantmentCost).toEqual({
			money: MONEY_PRICE, gems: GEMS_PRICE
		});
		expect(slot.itemEnchantmentId).toBe(ENCHANTMENT.id);
		expect(player.spendMoney).toHaveBeenCalledWith({
			response, amount: MONEY_PRICE, reason: NumberChangeReason.ENCHANT_ITEM
		});
		expect(missionsInfo.spendGems).toHaveBeenCalledWith(GEMS_PRICE, response, NumberChangeReason.ENCHANT_ITEM);
		expect([player.money, missionsInfo.gems]).toEqual([0, 0]);
		expect(slot.save).toHaveBeenCalled();
		expect(player.save).toHaveBeenCalled();
		expect(missionsInfo.save).toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportItemEnchantedRes", {
			enchantmentId: ENCHANTMENT.id, enchantmentType: ENCHANTMENT.kind.type.id
		}]]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "enchantItem" });
		expect(logs?.logEnchanterUse).toHaveBeenCalledWith({
			keycloakId: player.keycloakId,
			cityId: "boug_coton",
			itemCategory: ItemCategory.WEAPON,
			slot: 0,
			enchantmentId: ENCHANTMENT.id,
			enchantmentType: ENCHANTMENT.kind.type.id,
			moneyPrice: MONEY_PRICE,
			gemsPrice: GEMS_PRICE
		});
	});

	it("charges a mage the reduced price shown by the menu", async () => {
		const player = makeHandlerPlayer(MAGE_MONEY_PRICE);
		player.class = ClassConstants.CLASSES_ID.MYSTIC_MAGE;
		const missionsInfo = makeMissionsInfo(MAGE_GEMS_PRICE);
		const slot = weapon();
		const data = await openEnchanter(player, [slot]);
		lockRows(player, missionsInfo, slot);

		await enchant(player, data);

		expect(data.enchanter?.enchantmentCost).toEqual({
			money: MAGE_MONEY_PRICE, gems: MAGE_GEMS_PRICE
		});
		expect([player.money, missionsInfo.gems]).toEqual([0, 0]);
		expect(slot.itemEnchantmentId).toBe(ENCHANTMENT.id);
	});

	it("spends no gem for an enchantment that costs none", async () => {
		const free = ItemEnchantment.ALL_ATTACK_1;
		vi.mocked(Settings.ENCHANTER_ENCHANTMENT_ID.getValue).mockResolvedValue(free.id);
		const player = makeHandlerPlayer(free.getEnchantmentCost(false).money);
		const missionsInfo = makeMissionsInfo(0);
		const slot = weapon();
		const data = await openEnchanter(player, [slot], free);
		lockRows(player, missionsInfo, slot);

		await enchant(player, data);

		expect(free.getEnchantmentCost(false).gems).toBe(0);
		expect(missionsInfo.spendGems).not.toHaveBeenCalled();
		expect(slot.itemEnchantmentId).toBe(free.id);
	});

	it("tells exactly which currencies are missing, without enchanting", async () => {
		const player = makeHandlerPlayer(MONEY_PRICE - 10);
		const slot = weapon();
		const data = await openEnchanter(player, [slot]);
		lockRows(player, makeMissionsInfo(GEMS_PRICE), slot);
		const noMoney = await enchant(player, data);
		player.money = MONEY_PRICE;
		lockRows(player, makeMissionsInfo(GEMS_PRICE - 1), slot);
		const noGems = await enchant(player, data);

		expect(describePackets(noMoney)).toEqual([["CommandReportEnchantNotEnoughCurrenciesRes", {
			missingMoney: 10, missingGems: 0
		}]]);
		expect(describePackets(noGems)).toEqual([["CommandReportEnchantNotEnoughCurrenciesRes", {
			missingMoney: 0, missingGems: 1
		}]]);
		expect(slot.itemEnchantmentId).toBeNull();
		expect(player.spendMoney).not.toHaveBeenCalled();
	});

	it("refuses an unlisted equipment without locking, and does nothing with an invalid enchantment of the day", async () => {
		const player = makeHandlerPlayer(MONEY_PRICE);
		const slot = weapon();
		const data = await openEnchanter(player, [slot]);
		const unlisted = await enchant(player, data, ItemCategory.ARMOR);
		const noEnchanter = await enchant(player, {} as ReactionCollectorCityData);
		vi.mocked(Settings.ENCHANTER_ENCHANTMENT_ID.getValue).mockResolvedValue("unknownEnchantment");
		const invalidSetting = await enchant(player, data);

		expect(describePackets(unlisted)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
		expect(describePackets(noEnchanter)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
		expect(invalidSetting).toEqual([]);
		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("refuses an equipment changed since the menu was opened", async () => {
		const player = makeHandlerPlayer(MONEY_PRICE);
		const missionsInfo = makeMissionsInfo(GEMS_PRICE);
		const data = await openEnchanter(player, [weapon()]);
		const enchantedMeanwhile = weapon(ItemEnchantment.ALL_ATTACK_1.id);
		lockRows(player, missionsInfo, enchantedMeanwhile);

		const response = await enchant(player, data);

		expect(describePackets(response)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
		expect(enchantedMeanwhile.itemEnchantmentId).toBe(ItemEnchantment.ALL_ATTACK_1.id);
		expect(player.spendMoney).not.toHaveBeenCalled();
	});

	it("refuses an equipment that cannot receive the enchantment of the day", async () => {
		const player = makeHandlerPlayer(MONEY_PRICE);
		const missionsInfo = makeMissionsInfo(GEMS_PRICE);
		const armor = Object.assign(makeInventorySlot({
			slot: 0, itemCategory: ItemCategory.ARMOR, itemId: COMMON_ARMOR_ID
		}), { save: vi.fn() });
		const data = await openEnchanter(player, [armor], ItemEnchantment.DEFENSE_1);
		lockRows(player, missionsInfo, armor);

		const response = await enchant(player, data, ItemCategory.ARMOR);

		expect(describePackets(response)).toEqual([["CommandReportItemCannotBeEnchantedRes", {}]]);
		expect(armor.itemEnchantmentId).toBeNull();
		expect(player.spendMoney).not.toHaveBeenCalled();
	});

	// Bug: handleEnchantReaction (ReportCityEnchanterService.ts) applies and charges the enchantment of the day read at confirmation time, not the one the menu showed: a menu opened before the daily rotation grants another enchantment at another price
	it.fails("does not grant another enchantment than the one the menu showed", async () => {
		const player = makeHandlerPlayer(1_000_000);
		const missionsInfo = makeMissionsInfo(1_000);
		const slot = weapon();
		const data = await openEnchanter(player, [slot]);
		vi.mocked(Settings.ENCHANTER_ENCHANTMENT_ID.getValue).mockResolvedValue(ItemEnchantment.ALL_ATTACK_1.id);
		lockRows(player, missionsInfo, slot);

		await enchant(player, data);

		expect(slot.itemEnchantmentId).not.toBe(ItemEnchantment.ALL_ATTACK_1.id);
		expect(player.spendMoney).not.toHaveBeenCalledWith(expect.objectContaining({ amount: ItemEnchantment.ALL_ATTACK_1.getEnchantmentCost(false).money }));
	});

	it("does not log an enchantment made outside of a city", async () => {
		const player = makeHandlerPlayer(MONEY_PRICE);
		player.getCurrentCityId.mockReturnValue(null);
		const slot = weapon();
		const data = await openEnchanter(player, [slot]);
		lockRows(player, makeMissionsInfo(GEMS_PRICE), slot);

		await enchant(player, data);

		expect(slot.itemEnchantmentId).toBe(ENCHANTMENT.id);
		expect(logs?.logEnchanterUse).not.toHaveBeenCalled();
	});
});

describe("handleEnchanterDisenchantReaction", () => {
	async function disenchant(player: CityHandlerPlayer, data: ReactionCollectorCityData, itemCategory = ItemCategory.WEAPON): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		await handleEnchanterDisenchantReaction(asPlayer(player), {
			slot: 0, itemCategory
		}, data, response);
		return response;
	}

	it("removes the listed enchantment for free", async () => {
		const player = makeHandlerPlayer(0);
		const slot = weapon(ENCHANTMENT.id);
		const data = await openEnchanter(player, [slot]);
		lockRows(player, makeMissionsInfo(0), slot);

		const response = await disenchant(player, data);

		expect(slot.itemEnchantmentId).toBeNull();
		expect(slot.save).toHaveBeenCalled();
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportEnchanterDisenchantRes", {
			enchantmentId: ENCHANTMENT.id, enchantmentType: ENCHANTMENT.kind.type.id
		}]]);
		expect(logs?.logEnchanterDisenchant).toHaveBeenCalledWith({
			keycloakId: player.keycloakId, cityId: "boug_coton", itemCategory: ItemCategory.WEAPON, slot: 0, enchantmentId: ENCHANTMENT.id
		});
	});

	it("refuses an unlisted equipment and an equipment changed since the menu was opened", async () => {
		const player = makeHandlerPlayer(0);
		const data = await openEnchanter(player, [weapon(ENCHANTMENT.id)]);
		const unlisted = await disenchant(player, data, ItemCategory.ARMOR);
		const noEnchanter = await disenchant(player, {} as ReactionCollectorCityData);
		expect(withLockedEntities).not.toHaveBeenCalled();
		const changed = weapon(ItemEnchantment.ALL_ATTACK_1.id);
		lockRows(player, makeMissionsInfo(0), changed);
		const changedResponse = await disenchant(player, data);

		expect([...unlisted, ...noEnchanter]).toEqual([]);
		expect(describePackets(changedResponse)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
		expect(changed.itemEnchantmentId).toBe(ItemEnchantment.ALL_ATTACK_1.id);
		expect(logs?.logEnchanterDisenchant).not.toHaveBeenCalled();
	});

	it("does not log a disenchantment made outside of a city", async () => {
		const player = makeHandlerPlayer(0);
		player.getCurrentCityId.mockReturnValue(null);
		const slot = weapon(ENCHANTMENT.id);
		const data = await openEnchanter(player, [slot]);
		lockRows(player, makeMissionsInfo(0), slot);

		await disenchant(player, data);

		expect(slot.itemEnchantmentId).toBeNull();
		expect(logs?.logEnchanterDisenchant).not.toHaveBeenCalled();
	});
});
