import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { Badge } from "../../../../../../Lib/src/types/Badge";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class PlayerBadges extends Model {
	declare readonly playerId: number;

	declare badge: Badge;

	declare updatedAt: Date;

	declare createdAt: Date;
}

/**
 * This class is used to manage the badges of players
 */
export class PlayerBadgesManager {
	/**
	 * Get all badges of a player
	 * @param playerId
	 */
	public static async getOfPlayer(playerId: number): Promise<Badge[]> {
		const badges = await PlayerBadges.findAll({
			where: { playerId }
		});
		return badges.map(b => b.badge);
	}

	/**
	 * Check if a player has a specific badge
	 * @param playerId
	 * @param badge
	 */
	public static async hasBadge(playerId: number, badge: Badge): Promise<boolean> {
		const existing = await PlayerBadges.findOne({
			where: { playerId, badge }
		});
		return existing !== null;
	}

	/**
	 * Add a badge to a player
	 * @param playerId
	 * @param badge
	 * @returns true if badge was added, false if player already had it
	 */
	public static async addBadge(playerId: number, badge: Badge): Promise<boolean> {
		const [, created] = await PlayerBadges.findOrCreate({
			where: { playerId, badge }
		});
		return created;
	}

	/**
	 * Set badges for a player (replaces all existing badges)
	 * @param playerId
	 * @param badges
	 */
	public static async setBadges(playerId: number, badges: Badge[]): Promise<void> {
		await PlayerBadges.destroy({
			where: { playerId }
		});
		if (badges.length > 0) {
			await PlayerBadges.bulkCreate(
				badges.map(badge => ({ playerId, badge }))
			);
		}
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerBadges.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		badge: {
			type: DataTypes.STRING(32), // eslint-disable-line new-cap
			primaryKey: true
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
		tableName: "player_badges",
		freezeTableName: true
	});

	PlayerBadges.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default PlayerBadges;
