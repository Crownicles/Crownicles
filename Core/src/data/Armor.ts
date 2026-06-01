import { MainItem } from "./MainItem";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ItemDataController } from "./DataController";

export class Armor extends MainItem {
	categoryName = "armors";

	protected getBaseAttack(): number {
		return this.attack ?? 0;
	}

	public getAttack(itemLevel: number): number {
		const baseAttack = this.getBaseAttack();
		if (baseAttack > 0) {
			return Math.round(this.getBaseAttack() * Armor.getStatMultiplier(itemLevel));
		}
		return baseAttack;
	}

	public getCategory(): ItemCategory {
		return ItemCategory.ARMOR;
	}

	protected getBaseDefense(): number {
		return Math.round(1.15053 * Math.pow(this.multiplier(), 2.3617) * Math.pow(1.0569 + 0.1448 / this.multiplier(), this.rawDefense ?? 0)) + (this.defense ?? 0);
	}

	public getDefense(itemLevel: number): number {
		const baseDefense = this.getBaseDefense();
		if (baseDefense > 0) {
			return Math.round(this.getBaseDefense() * Armor.getStatMultiplier(itemLevel));
		}
		return baseDefense;
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
