import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { HomeLevel } from "../../../../../../Lib/src/types/HomeLevel";
import * as moment from "moment";
import { HomeChestSlots } from "./HomeChestSlot";

export class Home extends Model {
	declare readonly id: number;

	declare readonly ownerId: number;

	declare cityId: string;

	declare level: number;

	declare updatedAt: Date;

	declare createdAt: Date;


	public getLevel(): HomeLevel | null {
		return HomeLevel.getByLevel(this.level);
	}
}

export class Homes {
	public static async getOfPlayer(playerId: number): Promise<Home | null> {
		return await Home.findOne({
			where: { ownerId: playerId }
		});
	}

	public static async getHomesCount(): Promise<{
		cityId: string;
		count: number;
	}[]> {
		const results = await Home.findAll({
			attributes: [
				"cityId",
				[Sequelize.fn("COUNT", Sequelize.col("cityId")), "count"]
			],
			group: ["cityId"],
			order: [["count", "DESC"]]
		});

		return results.map(result => ({
			cityId: result.cityId,
			count: (result.get("count") as unknown) as number
		}));
	}

	public static async createOrUpdateHome(ownerId: number, cityId: string, level: number): Promise<Home> {
		let home = await Home.findOne({
			where: { ownerId }
		});

		if (home) {
			home.cityId = cityId;
			home.level = level;
			await home.save();
		}
		else {
			home = await Home.create({
				ownerId,
				cityId,
				level
			});
		}

		return home;
	}

	public static async deleteOfPlayer(playerId: number): Promise<void> {
		const home = await Home.findOne({ where: { ownerId: playerId } });

		if (home) {
			await HomeChestSlots.deleteOfHome(home.id);
			await home.destroy();
		}
	}
}

export function initModel(sequelize: Sequelize): void {
	Home.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		ownerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		cityId: {
			type: DataTypes.STRING,
			allowNull: false
		},
		level: {
			type: DataTypes.INTEGER,
			defaultValue: 1
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
		tableName: "homes",
		freezeTableName: true
	})
		.beforeSave(instance => {
			instance.updatedAt = moment()
				.toDate();
		});
}

export default Home;
