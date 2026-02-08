import InventorySlot, { InventorySlots } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import { City } from "../../data/City";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { WeaponDataController } from "../../data/Weapon";
import { ArmorDataController } from "../../data/Armor";
import { BlacksmithConstants } from "../../../../Lib/src/constants/BlacksmithConstants";

/**
 * Build enchanter data for the city reaction collector
 */
export function buildEnchanterData(
	playerInventory: InventorySlot[],
	player: Player,
	enchantment: ItemEnchantment,
	enchantmentId: string,
	isPlayerMage: boolean
): NonNullable<ReactionCollectorCityData["enchanter"]> {
	const isEquipment = (i: InventorySlot): boolean => (i.isWeapon() || i.isArmor()) && i.itemId !== 0;

	return {
		enchantableItems: playerInventory
			.filter(i => isEquipment(i) && !i.itemEnchantmentId)
			.map(i => ({
				category: i.itemCategory,
				slot: i.slot,
				details: i.itemWithDetails(player) as MainItemDetails
			})),
		isInventoryEmpty: playerInventory.filter(isEquipment).length === 0,
		hasAtLeastOneEnchantedItem: playerInventory.some(i => isEquipment(i) && Boolean(i.itemEnchantmentId)),
		enchantmentId,
		enchantmentCost: enchantment.getEnchantmentCost(isPlayerMage),
		enchantmentType: enchantment.kind.type.id,
		mageReduction: isPlayerMage
	};
}

/**
 * Build home data (owned home + manage options) for the city reaction collector
 */
export async function buildHomeData(
	player: Player,
	city: City,
	home: Home | null,
	homeLevel: HomeLevel | null,
	playerInventory: InventorySlot[],
	playerMaterialMap: Map<number, number>
): Promise<ReactionCollectorCityData["home"]> {
	const isHomeInCity = Boolean(home && home.cityId === city.id && homeLevel);
	const nextHomeUpgrade = homeLevel ? HomeLevel.getNextUpgrade(homeLevel, player.level) : null;

	const upgradeStation = isHomeInCity
		? buildUpgradeStationData(playerInventory, playerMaterialMap, homeLevel!, player)
		: undefined;

	const owned = isHomeInCity
		? {
			level: home!.level,
			features: homeLevel!.features,
			upgradeStation
		}
		: undefined;

	const homesCount = await Homes.getHomesCount();

	const manage: ReactionCollectorCityData["home"]["manage"] = {
		newPrice: home ? undefined : city.getHomeLevelPrice(HomeLevel.getInitialLevel(), homesCount),
		upgrade: nextHomeUpgrade && isHomeInCity
			? {
				price: city.getHomeLevelPrice(nextHomeUpgrade, homesCount),
				oldFeatures: homeLevel!.features,
				newFeatures: nextHomeUpgrade.features
			}
			: undefined,
		movePrice: home && home.cityId !== city.id && homeLevel
			? city.getHomeLevelPrice(homeLevel, homesCount)
			: undefined,
		currentMoney: player.money
	};

	const hasManageOptions = manage.newPrice || manage.upgrade || manage.movePrice;

	return {
		owned,
		manage: hasManageOptions ? manage : undefined
	};
}

/**
 * Build upgrade station data for the home feature in the city collector.
 * Determines which items can be upgraded at home and their material requirements.
 */
export function buildUpgradeStationData(
	playerInventory: Awaited<ReturnType<typeof InventorySlots.getOfPlayer>>,
	playerMaterialMap: Map<number, number>,
	homeLevel: HomeLevel,
	player: Player
): NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["upgradeStation"]> {
	const maxUpgradeableRarity = homeLevel.features.upgradeItemMaximumRarity;
	const maxLevelAtHome = homeLevel.features.maxItemUpgradeLevel;

	const upgradeableItems: NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["upgradeStation"]>["upgradeableItems"] = [];

	for (const inventorySlot of playerInventory) {
		// Only process weapons and armors with a valid item
		if ((!inventorySlot.isWeapon() && !inventorySlot.isArmor()) || inventorySlot.itemId === 0) {
			continue;
		}

		// Get the item data
		const itemData = inventorySlot.isWeapon()
			? WeaponDataController.instance.getById(inventorySlot.itemId)
			: ArmorDataController.instance.getById(inventorySlot.itemId);

		if (!itemData) {
			continue;
		}

		// Check if item level allows upgrade at home (limited by home's maxItemUpgradeLevel)
		const currentLevel = inventorySlot.itemLevel ?? 0;
		if (currentLevel >= maxLevelAtHome) {
			continue;
		}

		// Check if item rarity is allowed at this home level
		if (itemData.rarity > maxUpgradeableRarity) {
			continue;
		}

		const nextLevel = currentLevel + 1;
		const requiredMaterialsRaw = itemData.getUpgradeMaterials(nextLevel);

		// Aggregate materials (same material can appear multiple times)
		const materialAggregation = new Map<number, number>();
		for (const material of requiredMaterialsRaw) {
			const materialIdNum = parseInt(material.id, 10);
			materialAggregation.set(materialIdNum, (materialAggregation.get(materialIdNum) ?? 0) + 1);
		}

		const requiredMaterials: typeof upgradeableItems[number]["requiredMaterials"] = [];
		let canUpgrade = true;

		for (const [materialId, quantity] of materialAggregation) {
			const playerQuantity = playerMaterialMap.get(materialId) ?? 0;
			requiredMaterials.push({
				materialId,
				quantity,
				playerQuantity
			});
			if (playerQuantity < quantity) {
				canUpgrade = false;
			}
		}

		upgradeableItems.push({
			slot: inventorySlot.slot,
			category: inventorySlot.itemCategory,
			details: inventorySlot.itemWithDetails(player) as MainItemDetails,
			nextLevel,
			requiredMaterials,
			canUpgrade
		});
	}

	return {
		upgradeableItems,
		maxUpgradeableRarity
	};
}

/**
 * Build blacksmith data for the city collector.
 * The blacksmith allows upgrading items beyond home level and disenchanting items.
 */
export function buildBlacksmithData(
	playerInventory: Awaited<ReturnType<typeof InventorySlots.getOfPlayer>>,
	playerMaterialMap: Map<number, number>,
	player: Player
): NonNullable<ReactionCollectorCityData["blacksmith"]> {
	const upgradeableItems: NonNullable<ReactionCollectorCityData["blacksmith"]>["upgradeableItems"] = [];
	const disenchantableItems: NonNullable<ReactionCollectorCityData["blacksmith"]>["disenchantableItems"] = [];

	for (const inventorySlot of playerInventory) {
		// Only process weapons and armors with a valid item
		if ((!inventorySlot.isWeapon() && !inventorySlot.isArmor()) || inventorySlot.itemId === 0) {
			continue;
		}

		// Get the item data
		const itemData = inventorySlot.isWeapon()
			? WeaponDataController.instance.getById(inventorySlot.itemId)
			: ArmorDataController.instance.getById(inventorySlot.itemId);

		if (!itemData) {
			continue;
		}

		const currentLevel = inventorySlot.itemLevel ?? 0;

		// Check if item can be upgraded at the blacksmith (level < MAX_UPGRADE_LEVEL)
		if (currentLevel < BlacksmithConstants.MAX_UPGRADE_LEVEL) {
			const nextLevel = currentLevel + 1 as 1 | 2 | 3 | 4;
			const requiredMaterialsRaw = itemData.getUpgradeMaterials(nextLevel);

			// Aggregate materials with rarity info
			const materialAggregation = new Map<number, {
				quantity: number; rarity: number;
			}>();
			for (const material of requiredMaterialsRaw) {
				const materialIdNum = parseInt(material.id, 10);
				const existing = materialAggregation.get(materialIdNum);
				if (existing) {
					existing.quantity += 1;
				}
				else {
					materialAggregation.set(materialIdNum, {
						quantity: 1,
						rarity: material.rarity
					});
				}
			}

			const requiredMaterials: typeof upgradeableItems[number]["requiredMaterials"] = [];
			const missingMaterials: {
				rarity: number; quantity: number;
			}[] = [];
			let hasAllMaterials = true;

			for (const [
				materialId, {
					quantity, rarity
				}
			] of materialAggregation) {
				const playerQuantity = playerMaterialMap.get(materialId) ?? 0;
				requiredMaterials.push({
					materialId,
					rarity,
					quantity,
					playerQuantity
				});
				if (playerQuantity < quantity) {
					hasAllMaterials = false;
					missingMaterials.push({
						rarity,
						quantity: quantity - playerQuantity
					});
				}
			}

			const upgradeCost = BlacksmithConstants.getUpgradePrice(nextLevel, itemData.rarity);
			const missingMaterialsCost = BlacksmithConstants.getMaterialsPurchasePrice(missingMaterials);

			upgradeableItems.push({
				slot: inventorySlot.slot,
				category: inventorySlot.itemCategory,
				details: inventorySlot.itemWithDetails(player) as MainItemDetails,
				nextLevel,
				upgradeCost,
				requiredMaterials,
				missingMaterialsCost,
				hasAllMaterials
			});
		}

		// Check if item can be disenchanted (has an enchantment)
		if (inventorySlot.itemEnchantmentId) {
			const enchantment = ItemEnchantment.getById(inventorySlot.itemEnchantmentId);
			if (enchantment) {
				disenchantableItems.push({
					slot: inventorySlot.slot,
					category: inventorySlot.itemCategory,
					details: inventorySlot.itemWithDetails(player) as MainItemDetails,
					enchantmentId: inventorySlot.itemEnchantmentId,
					enchantmentType: enchantment.kind.type.id,
					disenchantCost: BlacksmithConstants.getDisenchantPrice(itemData.rarity)
				});
			}
		}
	}

	return {
		upgradeableItems,
		disenchantableItems,
		playerMoney: player.money
	};
}
