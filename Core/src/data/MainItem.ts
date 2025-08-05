import { GenericItem } from "./GenericItem";
import { MainItemDisplayPacket } from "../../../Lib/src/packets/commands/CommandInventoryPacket";
import { StatValues } from "../../../Lib/src/types/StatValues";
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

	public getDisplayPacket(maxStatsValue: StatValues = {
		attack: Infinity,
		defense: Infinity,
		speed: Infinity
	}): MainItemDisplayPacket {
		return {
			itemCategory: this.getCategory(),
			attack: {
				value: this.getAttack(),
				max: maxStatsValue.attack
			},
			defense: {
				value: this.getDefense(),
				max: maxStatsValue.defense
			},
			speed: {
				value: this.getSpeed(),
				max: maxStatsValue.speed
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
