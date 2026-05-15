import {
	DataTypes, Model, Sequelize
} from "sequelize";
import * as moment from "moment";
import {
	LockKey, withLockedEntities
} from "../../../../../../Lib/src/locks/withLockedEntities";

export class Apartment extends Model {
	/**
	 * Build a {@link LockKey} for this apartment so it can participate in a
	 * `withLockedEntities([...])` composite critical section.
	 */
	static lockKey(id: number): LockKey<Apartment> {
		return {
			model: Apartment, id
		};
	}

	/**
	 * Convenience helper for the common case of locking a single apartment.
	 */
	static withLocked<R>(id: number, fn: (apartment: Apartment) => Promise<R>): Promise<R> {
		return withLockedEntities([Apartment.lockKey(id)], ([apartment]) => fn(apartment));
	}

	declare readonly id: number;

	declare readonly ownerId: number;

	declare cityId: string;

	declare purchasePrice: number;

	declare lastRentClaimedAt: Date;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class Apartments {
	public static async getOfPlayer(playerId: number): Promise<Apartment[]> {
		return await Apartment.findAll({
			where: { ownerId: playerId }
		});
	}

	public static async getOfPlayerInCity(playerId: number, cityId: string): Promise<Apartment | null> {
		return await Apartment.findOne({
			where: {
				ownerId: playerId,
				cityId
			}
		});
	}

	public static async deleteOfPlayer(playerId: number): Promise<void> {
		await Apartment.destroy({ where: { ownerId: playerId } });
	}
}

export function initModel(sequelize: Sequelize): void {
	Apartment.init({
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
		purchasePrice: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		lastRentClaimedAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
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
		tableName: "apartments",
		freezeTableName: true,
		indexes: [
			{
				unique: true,
				fields: ["ownerId", "cityId"]
			}
		]
	})
		.beforeSave(instance => {
			instance.updatedAt = moment()
				.toDate();
		});
}

export default Apartment;
