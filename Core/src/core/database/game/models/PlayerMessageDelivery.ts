import {
	DataTypes, Model, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import moment from "moment";

export class PlayerMessageDelivery extends Model {
	declare readonly playerId: number;

	declare destinationLocationId: number;

	declare secretEmoji: string;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class PlayerMessageDeliveries {
	public static async getOfPlayer(playerId: number): Promise<PlayerMessageDelivery | null> {
		return await PlayerMessageDelivery.findOne({
			where: { playerId }
		});
	}

	public static async createDelivery(
		playerId: number,
		destinationLocationId: number,
		secretEmoji: string
	): Promise<PlayerMessageDelivery> {
		const existing = await PlayerMessageDeliveries.getOfPlayer(playerId);
		if (existing) {
			existing.destinationLocationId = destinationLocationId;
			existing.secretEmoji = secretEmoji;
			await existing.save();
			return existing;
		}

		return await PlayerMessageDelivery.create({
			playerId,
			destinationLocationId,
			secretEmoji
		});
	}

	public static async removeOfPlayer(playerId: number): Promise<void> {
		await PlayerMessageDelivery.destroy({
			where: { playerId }
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerMessageDelivery.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			allowNull: false
		},
		destinationLocationId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		secretEmoji: {
			type: DataTypes.STRING,
			allowNull: false
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
		tableName: "player_message_deliveries",
		freezeTableName: true
	});

	PlayerMessageDelivery.beforeSave(instance => {
		instance.updatedAt = moment().toDate();
	});
}

export default PlayerMessageDelivery;
