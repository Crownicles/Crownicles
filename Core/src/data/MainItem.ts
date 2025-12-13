import { GenericItem } from "./GenericItem";
import { StatValues } from "../../../Lib/src/types/StatValues";
import { InventoryConstants } from "../../../Lib/src/constants/InventoryConstants";
import {
	ItemConstants, ItemRarity
} from "../../../Lib/src/constants/ItemConstants";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { MaterialType } from "../../../Lib/src/types/MaterialType";
import {
	Material, MaterialDataController
} from "./Material";
import { MaterialRarity } from "../../../Lib/src/types/MaterialRarity";

export abstract class MainItem extends GenericItem {
	public readonly rawAttack?: number;

	public readonly rawDefense?: number;

	public readonly attack?: number;

	public readonly defense?: number;

	public readonly speed?: number;

	public readonly type!: MaterialType;


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
	 * Get the upgrade materials for a given level
	 * @param level
	 */
	public getUpgradeMaterials(level: number): Material[] {
		if (level < 0) {
			level = 0;
		}
		if (level > ItemConstants.MAX_UPGRADE_LEVEL) {
			level = ItemConstants.MAX_UPGRADE_LEVEL;
		}

		let materials = this.upgradeMaterialsCache.get(level);
		if (!materials) {
			const seed = this.id << 4 | level;

			const upgradeMaterialsCounts = ItemConstants.UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL[this.rarity as ItemRarity][level as 1 | 2 | 3 | 4 | 5];
			const upgradeMaterials = MaterialDataController.instance.getMaterialsFromType(this.type);

			materials = [];

			// For each material rarity, get random materials with the seed
			for (const countEntry of Object.entries(upgradeMaterialsCounts)) {
				const materialRarity = Number(countEntry[0]) as MaterialRarity;
				const count = countEntry[1];

				if (count > 0) {
					const filteredMaterials = upgradeMaterials.filter(material => material.rarity === materialRarity);

					// Pseudo-random selection based on the seed
					for (let i = 0; i < count; i++) {
						const index = ((seed + i + materialRarity << 6) * 2654435761) % filteredMaterials.length;
						materials.push(filteredMaterials[index]);
					}
				}
			}

			this.upgradeMaterialsCache.set(level, materials);
		}

		return materials;
	}
}
