import {
	DataTypes, Model, Sequelize
} from "sequelize";
import {
	BlessingConstants, BlessingType
} from "../../../../../../Lib/src/constants/BlessingConstants";

export class GlobalBlessing extends Model {
	declare id: number;

	declare poolAmount: number;

	declare poolThreshold: number;

	declare poolStartedAt: Date;

	declare activeBlessingType: number;

	declare blessingEndAt: Date | null;

	declare lastTriggeredByKeycloakId: string | null;

	declare lastBlessingTriggeredAt: Date | null;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export abstract class GlobalBlessings {
	/**
	 * Get the singleton blessing row (always id=1)
	 */
	static async get(): Promise<GlobalBlessing> {
		const [blessing] = await GlobalBlessing.findOrCreate({
			where: { id: 1 },
			defaults: {
				id: 1,
				poolAmount: 0,
				poolThreshold: BlessingConstants.INITIAL_POOL_THRESHOLD,
				poolStartedAt: new Date(),
				activeBlessingType: BlessingType.NONE,
				blessingEndAt: null,
				lastTriggeredByKeycloakId: null,
				lastBlessingTriggeredAt: null
			}
		});
		return blessing;
	}
}

export function initModel(sequelize: Sequelize): void {
	GlobalBlessing.init({
		id: {
			type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1
		},
		poolAmount: {
			type: DataTypes.INTEGER, defaultValue: 0, allowNull: false
		},
		poolThreshold: {
			type: DataTypes.INTEGER, defaultValue: BlessingConstants.INITIAL_POOL_THRESHOLD, allowNull: false
		},
		poolStartedAt: {
			type: DataTypes.DATE, allowNull: false
		},
		activeBlessingType: {
			type: DataTypes.INTEGER, defaultValue: BlessingType.NONE, allowNull: false
		},
		blessingEndAt: {
			type: DataTypes.DATE, allowNull: true
		},
		lastTriggeredByKeycloakId: {
			type: DataTypes.STRING, allowNull: true
		},
		lastBlessingTriggeredAt: {
			type: DataTypes.DATE, allowNull: true
		},
		updatedAt: { type: DataTypes.DATE },
		createdAt: { type: DataTypes.DATE }
	}, {
		sequelize, tableName: "global_blessings", freezeTableName: true
	});
}

export default GlobalBlessing;
