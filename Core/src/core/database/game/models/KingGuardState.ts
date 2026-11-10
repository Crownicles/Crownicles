import {
	DataTypes, Model, Op, Sequelize
} from "sequelize";
import {
	LockKey, withLockedEntities
} from "../../../../../../Lib/src/locks/withLockedEntities";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import moment from "moment";

/**
 * Hidden rating and record of a guard of the library, which never changes otherwise (see KingGuardDataController)
 */
export class KingGuardState extends Model {
	/**
	 * Build a {@link LockKey} for this guard so that its rating is updated in the same critical section as the one of the player it fought
	 */
	static lockKey(id: number): LockKey<KingGuardState> {
		return {
			model: KingGuardState, id
		};
	}

	/**
	 * Convenience helper for locking a single guard.
	 * See {@link withLockedEntities} for full semantics.
	 */
	static withLocked<R>(id: number, fn: (guard: KingGuardState) => Promise<R>): Promise<R> {
		return withLockedEntities([KingGuardState.lockKey(id)], ([guard]) => fn(guard));
	}

	declare readonly id: number;

	declare glory: number;

	declare wins: number;

	declare losses: number;

	declare draws: number;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export abstract class KingGuardStates {
	/**
	 * Give their initial rating to the guards of the library not yet in the table, the others keep the rating they earned
	 * @param guards
	 */
	static async insertMissing(guards: {
		id: number;
		initialGlory: number;
	}[]): Promise<void> {
		await KingGuardState.bulkCreate(guards.map(guard => ({
			id: guard.id,
			glory: guard.initialGlory
		})), { ignoreDuplicates: true });
	}

	/**
	 * Get the guards whose rating is the closest to the given one, the closest first
	 * @param params - The rating, the ids of the guards that may be chosen and how many to return
	 */
	static async findClosest(params: {
		rating: number;
		guardIds: number[];
		count: number;
	}): Promise<KingGuardState[]> {
		if (params.guardIds.length === 0) {
			return [];
		}
		return await KingGuardState.findAll({
			where: { id: { [Op.in]: params.guardIds } },
			order: [
				[Sequelize.literal(`ABS(glory - ${Math.round(params.rating)})`), "ASC"],
				["id", "ASC"]
			],
			limit: params.count
		});
	}

	/**
	 * Get the current rating of the given guards, or of all of them
	 * @param ids
	 */
	static async getGlories(ids?: number[]): Promise<Map<number, number>> {
		const guards = await KingGuardState.findAll({
			attributes: ["id", "glory"],
			...ids ? { where: { id: { [Op.in]: ids } } } : {}
		});
		return new Map(guards.map(guard => [guard.id, guard.glory]));
	}
}

export function initModel(sequelize: Sequelize): void {
	KingGuardState.init({
		id: {
			type: DataTypes.SMALLINT.UNSIGNED,
			primaryKey: true
		},
		glory: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		wins: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		},
		losses: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
			defaultValue: 0
		},
		draws: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false,
			defaultValue: 0
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
		tableName: "king_guards",
		freezeTableName: true
	});

	KingGuardState.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default KingGuardState;
