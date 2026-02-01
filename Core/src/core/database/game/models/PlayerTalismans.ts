import {
	DataTypes, Model, Sequelize
} from "sequelize";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class PlayerTalismans extends Model {
	declare readonly playerId: number;

	declare hasTalisman: boolean;

	declare hasCloneTalisman: boolean;

	declare updatedAt: Date;

	declare createdAt: Date;
}

/**
 * This class is used to treat the talismans of a player
 */
export class PlayerTalismansManager {
	/**
	 * Get the talismans of a player
	 * @param playerId
	 */
	public static async getOfPlayer(playerId: number): Promise<PlayerTalismans> {
		return (await PlayerTalismans.findOrCreate({
			where: { playerId }
		}))[0];
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerTalismans.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		hasTalisman: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		hasCloneTalisman: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
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
		tableName: "player_talismans",
		freezeTableName: true
	});

	PlayerTalismans.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default PlayerTalismans;
