import {DataTypes, Model, Sequelize} from "sequelize";
import {Constants} from "../../../Constants";
import moment = require("moment");

export class InventoryInfo extends Model {
	public readonly playerId!: number;

	public lastDailyAt: Date;

	public weaponSlots!: number;

	public armorSlots!: number;

	public potionSlots!: number;

	public objectSlots!: number;

	public updatedAt!: Date;

	public createdAt!: Date;


	public slotLimitForCategory(category: number): number {
		switch (category) {
		case Constants.ITEM_CATEGORIES.WEAPON:
			return this.weaponSlots;
		case Constants.ITEM_CATEGORIES.ARMOR:
			return this.armorSlots;
		case Constants.ITEM_CATEGORIES.POTION:
			return this.potionSlots;
		case Constants.ITEM_CATEGORIES.OBJECT:
			return this.objectSlots;
		default:
			return 0;
		}
	}

	public addSlotForCategory(category: number): void {
		switch (category) {
		case Constants.ITEM_CATEGORIES.WEAPON:
			this.weaponSlots++;
			break;
		case Constants.ITEM_CATEGORIES.ARMOR:
			this.armorSlots++;
			break;
		case Constants.ITEM_CATEGORIES.POTION:
			this.potionSlots++;
			break;
		case Constants.ITEM_CATEGORIES.OBJECT:
			this.objectSlots++;
			break;
		default:
			break;
		}
	}

	public updateLastDailyAt(): void {
		this.lastDailyAt = moment().toDate(); // eslint-disable-line new-cap
	}

	public editDailyCooldown(hours: number): void {
		this.lastDailyAt = moment(this.lastDailyAt).add(hours, "h")
			.toDate(); // eslint-disable-line new-cap
	}
}

export class InventoryInfos {
	public static async getOfPlayer(playerId: number): Promise<InventoryInfo> {
		return (await InventoryInfo.findOrCreate({
			where: {
				playerId
			}
		}))[0];
	}
}

export function initModel(sequelize: Sequelize): void {
	InventoryInfo.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		lastDailyAt: {
			type: DataTypes.DATE,
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		},
		weaponSlots: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		armorSlots: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		potionSlots: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		objectSlots: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment().format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "inventory_info",
		freezeTableName: true
	});

	InventoryInfo.beforeSave(instance => {
		instance.updatedAt = moment().toDate();
	});
}

export default InventoryInfo;