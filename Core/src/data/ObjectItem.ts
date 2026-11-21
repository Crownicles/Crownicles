import {
	ItemCategory, ItemConstants, ItemNature
} from "../../../Lib/src/constants/ItemConstants";
import { ItemDataController } from "./DataController";
import { SupportItem } from "./SupportItem";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import {
	NO_STAT_COMPARISON, StatValues
} from "../../../Lib/src/types/StatValues";
import { SupportItemDetails } from "../../../Lib/src/types/SupportItemDetails";

/**
 * Stat boosted by the objects of each fight nature
 */
const BOOSTED_STAT_BY_NATURE = new Map<ItemNature, keyof StatValues>([
	[ItemNature.ATTACK, "attack"],
	[ItemNature.DEFENSE, "defense"],
	[ItemNature.SPEED, "speed"]
]);

export class ObjectItem extends SupportItem {
	categoryName = "objects";

	public getCategory(): ItemCategory {
		return ItemCategory.OBJECT;
	}

	public getItemAddedValue(): number {
		return this.power;
	}

	/**
	 * Stats the object adds to a player whose class gives maxStats: never more than
	 * {@link ItemConstants.OBJECT_MAX_CLASS_STAT_MULTIPLIER} times the class value of the stat it boosts
	 * @param maxStats
	 */
	public getCappedStats(maxStats: StatValues): StatValues {
		return {
			attack: Math.min(this.getAttack(), maxStats.attack * ItemConstants.OBJECT_MAX_CLASS_STAT_MULTIPLIER),
			defense: Math.min(this.getDefense(), maxStats.defense * ItemConstants.OBJECT_MAX_CLASS_STAT_MULTIPLIER),
			speed: Math.min(this.getSpeed(), maxStats.speed * ItemConstants.OBJECT_MAX_CLASS_STAT_MULTIPLIER)
		};
	}

	public getDisplayPacket(maxStatsValue: StatValues = NO_STAT_COMPARISON): SupportItemDetails {
		const boostedStat = BOOSTED_STAT_BY_NATURE.get(this.nature);
		return {
			itemCategory: this.getCategory(),
			maxPower: boostedStat ? this.getCappedStats(maxStatsValue)[boostedStat] : this.power,
			nature: this.nature,
			power: this.power,
			rarity: this.rarity,
			id: this.id
		};
	}
}

export class ObjectItemDataController extends ItemDataController<ObjectItem> {
	static readonly instance: ObjectItemDataController = new ObjectItemDataController("objects");

	newInstance(): ObjectItem {
		return new ObjectItem();
	}

	public randomItem(nature: number, rarity: number): ObjectItem {
		return RandomUtils.crowniclesRandom.pick(this.getValuesArray()
			.filter(item => item.nature === nature && item.rarity === rarity));
	}
}
