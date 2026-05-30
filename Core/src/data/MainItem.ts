import { GenericItem } from "./GenericItem";
import { StatValues } from "../../../Lib/src/types/StatValues";
import { InventoryConstants } from "../../../Lib/src/constants/InventoryConstants";
import {
	ItemConstants, ItemRarity, UpgradeLevel
} from "../../../Lib/src/constants/ItemConstants";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { MaterialType } from "../../../Lib/src/types/MaterialType";
import {
	Material, MaterialDataController
} from "./Material";
import { MaterialRarity } from "../../../Lib/src/types/MaterialRarity";
import {
	DISTINCT_MATERIALS_PER_ITEM_RARITY_AND_LEVEL,
	ItemMaterialCategory,
	MATERIAL_POOLS_PER_CATEGORY,
	pickDistinctMaterials
} from "../../../Lib/src/constants/ItemMaterialCategoryConstants";

export abstract class MainItem extends GenericItem {
	public readonly rawAttack?: number;

	public readonly rawDefense?: number;

	public readonly attack?: number;

	public readonly defense?: number;

	public readonly speed?: number;

	public readonly type!: MaterialType;

	/**
	 * Category id (1..15) that drives which materials are required to upgrade
	 * this item at the blacksmith. See `Lib/src/constants/ItemMaterialCategoryConstants.ts`
	 * and `docs/design/item-material-categories.md`.
	 */
	public readonly materialCategory!: ItemMaterialCategory;


	private upgradeMaterialsCache: Map<number, Material[]> = new Map<number, Material[]>();


	protected abstract getBaseAttack(): number;

	protected abstract getBaseDefense(): number;

	public abstract getAttack(itemLevel: number): number;

	public abstract getDefense(itemLevel: number): number;

	private getBaseSpeed(): number {
		return this.speed ?? 0;
	}

	public getSpeed(itemLevel: number): number {
		const baseSpeed = this.getBaseSpeed();
		if (baseSpeed > 0) {
			return Math.round(this.getBaseSpeed() * MainItem.getStatMultiplier(itemLevel));
		}
		return baseSpeed;
	}

	public getDisplayPacket(itemLevel: number, itemEnchantmentId?: string, maxStatsValue: StatValues = {
		attack: Infinity,
		defense: Infinity,
		speed: Infinity
	}): MainItemDetails {
		const baseAttack = this.getBaseAttack();
		const baseDefense = this.getBaseDefense();
		const baseSpeed = this.getBaseSpeed();

		return {
			itemCategory: this.getCategory(),
			itemLevel,
			itemEnchantmentId,
			attack: {
				baseValue: baseAttack,
				upgradeValue: this.getAttack(itemLevel) - baseAttack,
				maxValue: maxStatsValue.attack
			},
			defense: {
				baseValue: baseDefense,
				upgradeValue: this.getDefense(itemLevel) - baseDefense,
				maxValue: maxStatsValue.defense
			},
			speed: {
				baseValue: baseSpeed,
				upgradeValue: this.getSpeed(itemLevel) - baseSpeed,
				maxValue: maxStatsValue.speed
			},
			rarity: this.rarity,
			id: this.id
		};
	}

	/**
	 * Get the multiplier for the item depending on its rarity
	 */
	protected multiplier(): number {
		return InventoryConstants.ITEMS_MAPPER[this.rarity];
	}

	/**
	 * Get the multiplier for stats depending on the item level
	 * @param itemLevel The item level
	 * @returns The multiplier
	 */
	protected static getStatMultiplier(itemLevel: number): number {
		if (itemLevel < 0) {
			itemLevel = 0;
		}
		if (itemLevel >= ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER.length) {
			itemLevel = ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER.length - 1;
		}
		return ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER[itemLevel];
	}

	/**
	 * Get the upgrade materials for a given level.
	 *
	 * Returns a flat `Material[]` where each material id may appear several
	 * times: downstream code (e.g. `ReportBlacksmithService`) aggregates by id
	 * to obtain `{ materialId, quantity }` pairs.
	 *
	 * Selection strategy:
	 * 1. Look up the item's `materialCategory` pool of materials, split by material rarity.
	 * 2. For each material rarity bucket, read the total quantity required from `ItemConstants.UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL` and the distinct material count from `DISTINCT_MATERIALS_PER_ITEM_RARITY_AND_LEVEL`.
	 * 3. Pick that many distinct ids from the pool with a deterministic sliding window (`pickDistinctMaterials`), so two consecutive levels share at least `distinctCount - 1` materials and we rotate through the whole pool over the five upgrade levels.
	 * 4. Distribute the total quantity across the picked ids (base quantity + 1 for the first `rem` positions) and emit each id that many times.
	 */
	public getUpgradeMaterials(level: number): Material[] {
		const clampedLevel = MainItem.clampUpgradeLevel(level);

		const cached = this.upgradeMaterialsCache.get(clampedLevel);
		if (cached) {
			return cached;
		}

		const materials = this.computeUpgradeMaterials(clampedLevel);
		this.upgradeMaterialsCache.set(clampedLevel, materials);
		return materials;
	}

	private static clampUpgradeLevel(level: number): number {
		if (level < 0) {
			return 0;
		}
		if (level > ItemConstants.MAX_UPGRADE_LEVEL) {
			return ItemConstants.MAX_UPGRADE_LEVEL;
		}
		return level;
	}

	private computeUpgradeMaterials(level: number): Material[] {
		if (level < ItemConstants.MIN_UPGRADE_LEVEL || level > ItemConstants.MAX_UPGRADE_LEVEL) {
			return [];
		}

		const itemRarity = this.rarity as ItemRarity;
		const upgradeLevel = level as UpgradeLevel;
		const totals = ItemConstants.UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL[itemRarity][upgradeLevel];
		const distincts = DISTINCT_MATERIALS_PER_ITEM_RARITY_AND_LEVEL[itemRarity][upgradeLevel - 1];
		const categoryPool = MATERIAL_POOLS_PER_CATEGORY[this.materialCategory];

		const materials: Material[] = [];
		for (const matRarity of [
			MaterialRarity.COMMON,
			MaterialRarity.UNCOMMON,
			MaterialRarity.RARE
		]) {
			this.appendRarityMaterials(materials, {
				matRarity,
				upgradeLevel,
				totalQty: totals[matRarity],
				distinct: distincts[matRarity],
				subPool: categoryPool[matRarity]
			});
		}
		return materials;
	}

	private appendRarityMaterials(materials: Material[], params: {
		matRarity: MaterialRarity;
		upgradeLevel: UpgradeLevel;
		totalQty: number;
		distinct: number;
		subPool: readonly number[];
	}): void {
		const {
			matRarity, upgradeLevel, totalQty, distinct, subPool
		} = params;
		if (totalQty <= 0) {
			return;
		}
		const distinctCount = Math.min(distinct, subPool.length, totalQty);
		if (distinctCount <= 0) {
			return;
		}

		const picked = pickDistinctMaterials(subPool, this.id, matRarity, upgradeLevel, distinctCount);
		const base = Math.floor(totalQty / picked.length);
		const rem = totalQty % picked.length;
		for (let i = 0; i < picked.length; i++) {
			this.pushMaterialCopies(materials, picked[i], base + (i < rem ? 1 : 0));
		}
	}

	private pushMaterialCopies(materials: Material[], materialId: number, quantity: number): void {
		const mat = MaterialDataController.instance.getById(String(materialId));
		if (!mat) {
			return;
		}
		for (let k = 0; k < quantity; k++) {
			materials.push(mat);
		}
	}
}
