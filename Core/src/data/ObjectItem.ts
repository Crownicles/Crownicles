import {
	ItemCategory, ItemNature
} from "../../../Lib/src/constants/ItemConstants";
import { ItemDataController } from "./DataController";
import { SupportItem } from "./SupportItem";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { SupportItemDisplayPacket } from "../../../Lib/src/packets/commands/CommandInventoryPacket";
import {
	NO_STAT_COMPARISON, StatValues
} from "../../../Lib/src/types/StatValues";

export class ObjectItem extends SupportItem {
	categoryName = "objects";

	public getCategory(): ItemCategory {
		return ItemCategory.OBJECT;
	}

	public getItemAddedValue(): number {
		return this.power;
	}

	public getDisplayPacket(maxStatsValue: StatValues = NO_STAT_COMPARISON): SupportItemDisplayPacket {
		let maxPower: number;
		switch (this.nature) {
			case ItemNature.ATTACK:
				maxPower = maxStatsValue.attack >= this.power / 2 ? this.power : maxStatsValue.attack * 2;
				break;
			case ItemNature.DEFENSE:
				maxPower = maxStatsValue.defense >= this.power / 2 ? this.power : maxStatsValue.defense * 2;
				break;
			case ItemNature.SPEED:
				maxPower = maxStatsValue.speed >= this.power / 2 ? this.power : maxStatsValue.speed * 2;
				break;
			default:
				maxPower = this.power;
				break;
		}
		return {
			itemCategory: this.getCategory(),
			maxPower,
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
