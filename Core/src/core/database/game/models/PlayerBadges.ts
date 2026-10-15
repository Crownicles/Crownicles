import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { Badge } from "../../../../../../Lib/src/types/Badge";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import moment from "moment";

export class PlayerBadges extends Model {
	declare readonly playerId: number;

	declare badge: Badge;

	/** Whether the app already celebrated this badge, on any of the player's devices. */
	declare revealedInApp: boolean;

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
			where: {
				playerId, badge
			}
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
			where: {
				playerId, badge
			}
		});
		return created;
	}

	/**
	 * Set badges for a player (replaces all existing badges)
	 * @param playerId
	 * @param badges
	 */
	public static async setBadges(playerId: number, badges: Badge[]): Promise<void> {
		const owned = await PlayerBadgesManager.getOfPlayer(playerId);
		const removed = owned.filter(badge => !badges.includes(badge));
		if (removed.length > 0) {
			await PlayerBadges.destroy({
				where: {
					playerId, badge: removed
				}
			});
		}

		// Badges kept keep their row, so the app does not celebrate them a second time.
		const added = badges.filter(badge => !owned.includes(badge));
		if (added.length > 0) {
			await PlayerBadges.bulkCreate(
				added.map(badge => ({
					playerId, badge
				}))
			);
		}
	}

	/**
	 * The badges the app has not celebrated yet, on any of the player's devices
	 * @param playerId
	 */
	public static async getUnrevealedInApp(playerId: number): Promise<Badge[]> {
		const badges = await PlayerBadges.findAll({
			where: {
				playerId, revealedInApp: false
			}
		});
		return badges.map(b => b.badge);
	}

	/**
	 * Record that the app celebrated these badges, so no other device celebrates them again
	 * @param playerId
	 * @param badges
	 */
	public static async markRevealedInApp(playerId: number, badges: Badge[]): Promise<void> {
		if (badges.length === 0) {
			return;
		}
		await PlayerBadges.update({ revealedInApp: true }, {
			where: {
				playerId, badge: badges
			}
		});
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
		revealedInApp: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
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
		tableName: "player_badges",
		freezeTableName: true
	});

	PlayerBadges.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default PlayerBadges;
