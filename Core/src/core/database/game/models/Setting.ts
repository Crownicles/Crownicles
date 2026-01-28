import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { PotionDataController } from "../../../../data/Potion";
import { MapCache } from "../../../maps/MapCache";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

class SettingClassNumber {
	private readonly name: string;

	private readonly defaultValue: (() => Promise<number>) | (() => number);

	constructor(name: string, defaultValue: (() => Promise<number>) | (() => number)) {
		this.name = name;
		this.defaultValue = defaultValue;
	}

	public async getValue(): Promise<number> {
		let value: number;

		const settingInstance = await Setting.findOne({
			where: { name: this.name }
		});

		if (settingInstance) {
			value = settingInstance.dataNumber ?? await this.defaultValue();
		}
		else {
			value = await this.defaultValue();
			await Setting.create({
				name: this.name,
				dataNumber: value
			});
		}

		return value;
	}

	public async setValue(value: number): Promise<void> {
		await Setting.update({
			dataNumber: value
		}, { where: { name: this.name } });
	}
}

// Currently keeping it for a future update
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class SettingClassString {
	private readonly name: string;

	private readonly defaultValue: () => Promise<string>;

	constructor(name: string, defaultValue: () => Promise<string>) {
		this.name = name;
		this.defaultValue = defaultValue;
	}

	public async getValue(): Promise<string> {
		let value: string;

		const settingInstance = await Setting.findOne({
			where: { name: this.name }
		});

		if (settingInstance) {
			value = settingInstance.dataString ?? await this.defaultValue();
		}
		else {
			value = await this.defaultValue();
			await Setting.create({
				name: this.name,
				dataString: value
			});
		}

		return value;
	}

	public async setValue(value: string): Promise<void> {
		await Setting.update({
			dataString: value
		}, { where: { name: this.name } });
	}
}

export class Setting extends Model {
	declare name: string;

	declare dataString?: string;

	declare dataNumber?: number;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class Settings {
	public static readonly SHOP_POTION = new SettingClassNumber(
		"shopPotion",
		(): number => PotionDataController.instance.randomShopPotion().id
	);

	public static readonly PVE_ISLAND = new SettingClassNumber(
		"pveIslandLink",
		(): Promise<number> => Promise.resolve(MapCache.randomPveBoatLinkId())
	);

	public static readonly NEXT_WEEKLY_RESET = new SettingClassNumber(
		"nextWeeklyReset",
		(): Promise<number> => Promise.resolve(0)
	);

	public static readonly NEXT_SEASON_RESET = new SettingClassNumber(
		"nextSeasonReset",
		(): Promise<number> => Promise.resolve(0)
	);

	public static readonly NEXT_DAILY_RESET = new SettingClassNumber(
		"nextDailyReset",
		(): Promise<number> => Promise.resolve(0)
	);

	/**
	 * The last year the Christmas bonus was applied (to avoid running it twice in the same year)
	 */
	public static readonly LAST_CHRISTMAS_BONUS_YEAR = new SettingClassNumber(
		"lastChristmasBonusYear",
		(): Promise<number> => Promise.resolve(0)
	);
}

export function initModel(sequelize: Sequelize): void {
	Setting.init({
		name: {
			type: DataTypes.STRING,
			primaryKey: true
		},
		dataString: {
			type: DataTypes.STRING,
			allowNull: true
		},
		dataNumber: {
			type: DataTypes.BIGINT,
			allowNull: true
		},
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		}
	}, {
		sequelize,
		tableName: "settings",
		freezeTableName: true
	});

	Setting.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default Setting;
