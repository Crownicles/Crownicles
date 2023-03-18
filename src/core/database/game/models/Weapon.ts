import {QueryTypes, Sequelize} from "sequelize";
import {MainItemModel, MainItemModelAttributes} from "./MainItemModel";
import {ItemConstants} from "../../../constants/ItemConstants";
import fs = require("fs");
import moment = require("moment");

export class Weapon extends MainItemModel {
	categoryName = "weapons";

	public getAttack(): number {
		return Math.round(1.15053 * Math.pow(this.multiplier(), 2.3617) * Math.pow(1.0569 + 0.1448 / this.multiplier(), this.rawAttack)) + this.attack;
	}

	public getCategory(): number {
		return ItemConstants.CATEGORIES.WEAPON;
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

export class Weapons {
	static getMaxId(): Promise<number> {
		return new Promise((resolve, reject) => {
			fs.readdir("resources/text/weapons/",
				(err, files) => {
					err ? reject(err) : resolve(files.length - 1);
				}
			);
		});
	}

	static getById(id: number): Promise<Weapon | null> {
		return Promise.resolve(Weapon.findOne({
			where: {
				id
			}
		}));
	}

	static getAllIdsForRarity(rarity: number): Promise<{ id: number }[]> {
		const query = `SELECT id
					   FROM weapons
                       WHERE rarity = :rarity`;
		return Promise.resolve(Weapon.sequelize.query(query, {
			replacements: {
				rarity: rarity
			},
			type: QueryTypes.SELECT
		})) as Promise<{ id: number }[]>;
	}
}

export function initModel(sequelize: Sequelize): void {
	Weapon.init(MainItemModelAttributes, {
		sequelize,
		tableName: "weapons",
		freezeTableName: true
	});

	Weapon.beforeSave(instance => {
		instance.updatedAt = moment().toDate();
	});
}

export default Weapon;