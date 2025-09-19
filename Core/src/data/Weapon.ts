import { MainItem } from "./MainItem";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ItemDataController } from "./DataController";

export class Weapon extends MainItem {
	categoryName = "weapons";

	protected getBaseAttack(): number {
		return Math.round(1.15053 * Math.pow(this.multiplier(), 2.3617) * Math.pow(1.0569 + 0.1448 / this.multiplier(), this.rawAttack)) + (this.attack ?? 0);
	}

	public getAttack(itemLevel: number): number {
		const baseAttack = this.getBaseAttack();
		if (baseAttack > 0) {
			return Math.round(this.getBaseAttack() * Weapon.getStatMultiplier(itemLevel));
		}
		return baseAttack;
	}

	public getCategory(): ItemCategory {
		return ItemCategory.WEAPON;
	}

	protected getBaseDefense(): number {
		return this.defense ?? 0;
	}

	public getDefense(itemLevel: number): number {
		const baseDefense = this.getBaseDefense();
		if (baseDefense > 0) {
			return Math.round(this.getBaseDefense() * Weapon.getStatMultiplier(itemLevel));
		}
		return baseDefense;
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
