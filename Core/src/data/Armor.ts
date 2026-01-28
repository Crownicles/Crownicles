import { MainItem } from "./MainItem";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ItemDataController } from "./DataController";

export class Armor extends MainItem {
	categoryName = "armors";

	public getAttack(): number {
		return this.attack ?? 0;
	}

	public getCategory(): ItemCategory {
		return ItemCategory.ARMOR;
	}

	public getDefense(): number {
		const rawDef = this.rawDefense ?? 0;
		return Math.round(1.15053 * Math.pow(this.multiplier(), 2.3617) * Math.pow(1.0569 + 0.1448 / this.multiplier(), rawDef)) + (this.defense ?? 0);
	}

	public getItemAddedValue(): number {
		return this.rawDefense ?? 0;
	}
}

export class ArmorDataController extends ItemDataController<Armor> {
	static readonly instance: ArmorDataController = new ArmorDataController("armors");

	newInstance(): Armor {
		return new Armor();
	}
}
