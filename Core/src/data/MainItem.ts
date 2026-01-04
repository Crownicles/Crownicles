import { GenericItem } from "./GenericItem";
import { MainItemDisplayPacket } from "../../../Lib/src/packets/commands/CommandInventoryPacket";
import {
	NO_STAT_COMPARISON, StatValues
} from "../../../Lib/src/types/StatValues";
import { InventoryConstants } from "../../../Lib/src/constants/InventoryConstants";

export abstract class MainItem extends GenericItem {
	public readonly rawAttack?: number;

	public readonly rawDefense?: number;

	public readonly attack?: number;

	public readonly defense?: number;

	public readonly speed?: number;


	public getSpeed(): number {
		return this.speed ?? 0;
	}

	public getDisplayPacket(maxStatsValue: StatValues = NO_STAT_COMPARISON): MainItemDisplayPacket {
		return {
			itemCategory: this.getCategory(),
			attack: {
				value: this.getAttack(),
				maxValue: maxStatsValue.attack
			},
			defense: {
				value: this.getDefense(),
				maxValue: maxStatsValue.defense
			},
			speed: {
				value: this.getSpeed(),
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
}
