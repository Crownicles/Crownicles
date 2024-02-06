import {MainItem} from "./MainItem";
import {ItemCategory} from "../../../Lib/src/constants/ItemConstants";
import {ItemDataController} from "./DataController";

export class Weapon extends MainItem {
	categoryName = "armors";

	public getAttack(): number {
		return Math.round(1.15053 * Math.pow(this.multiplier(), 2.3617) * Math.pow(1.0569 + 0.1448 / this.multiplier(), this.rawAttack)) + this.attack;
	}

	public getCategory(): ItemCategory {
		return ItemCategory.WEAPON;
	}

	public getDefense(): number {
		let before = 0;
		if (this.rawDefense > 0) {
			before = 1.15053 * Math.pow(this.multiplier(), 2.3617) * Math.pow(1.0569 + 0.1448 / this.multiplier(), this.rawDefense);
		}
		return Math.round(before * 0.75) + this.defense;
	}

	public getItemAddedValue(): number {
		return this.rawAttack;
	}
}

export class WeaponDataController extends ItemDataController<Weapon> {
	static readonly instance: WeaponDataController = new WeaponDataController("weapons");

	newInstance(): Weapon {
		return new Weapon();
	}
}