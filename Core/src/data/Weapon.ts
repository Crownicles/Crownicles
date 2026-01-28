import { MainItem } from "./MainItem";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ItemDataController } from "./DataController";

export class Weapon extends MainItem {
	categoryName = "weapons";

	public getAttack(): number {
		const rawAtk = this.rawAttack ?? 0;
		return Math.round(1.15053 * Math.pow(this.multiplier(), 2.3617) * Math.pow(1.0569 + 0.1448 / this.multiplier(), rawAtk)) + (this.attack ?? 0);
	}

	public getCategory(): ItemCategory {
		return ItemCategory.WEAPON;
	}

	public getDefense(): number {
		return this.defense ?? 0;
	}

	public getItemAddedValue(): number {
		return this.rawAttack ?? 0;
	}
}

export class WeaponDataController extends ItemDataController<Weapon> {
	static readonly instance: WeaponDataController = new WeaponDataController("weapons");

	newInstance(): Weapon {
		return new Weapon();
	}
}
