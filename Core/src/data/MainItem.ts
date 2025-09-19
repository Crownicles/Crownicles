import { GenericItem } from "./GenericItem";
import { StatValues } from "../../../Lib/src/types/StatValues";
import { InventoryConstants } from "../../../Lib/src/constants/InventoryConstants";
import { ItemConstants } from "../../../Lib/src/constants/ItemConstants";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";

export abstract class MainItem extends GenericItem {
	public readonly rawAttack?: number;

	public readonly rawDefense?: number;

	public readonly attack?: number;

	public readonly defense?: number;

	public readonly speed?: number;


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
		if (itemLevel > ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER.length) {
			itemLevel = ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER.length - 1;
		}
		return ItemConstants.UPGRADE_LEVEL_STATS_MULTIPLIER[itemLevel];
	}
}
