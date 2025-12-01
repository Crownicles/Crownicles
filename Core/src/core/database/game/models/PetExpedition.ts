import {
	DataTypes, Model, Sequelize
} from "sequelize";
import {
	ExpeditionConstants, ExpeditionLocationType, ExpeditionStatus
} from "../../../../../../Lib/src/constants/ExpeditionConstants";
import {
	ExpeditionData, ExpeditionInProgressData
} from "../../../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class PetExpedition extends Model {
	declare readonly id: number;

	declare playerId: number;

	declare petId: number;

	declare startDate: Date;

	declare endDate: Date;

	declare riskRate: number;

	declare difficulty: number;

	declare wealthRate: number;

	declare locationType: string;

	declare mapLocationId: number;

	declare status: string;

	declare foodConsumed: number;

	declare rewardIndex: number;

	declare isDistantExpedition: boolean;

	declare updatedAt: Date;

	declare createdAt: Date;

	/**
	 * Get the duration of the expedition in minutes
	 */
	public getDurationMinutes(): number {
		return Math.round((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60));
	}

	/**
	 * Check if the expedition has ended
	 */
	public hasEnded(): boolean {
		return Date.now() >= this.endDate.getTime();
	}

	/**
	 * Get remaining time in milliseconds
	 */
	public getRemainingTime(): number {
		return Math.max(0, this.endDate.getTime() - Date.now());
	}

	/**
	 * Check if the expedition is in progress
	 */
	public isInProgress(): boolean {
		return this.status === ExpeditionConstants.STATUS.IN_PROGRESS && !this.hasEnded();
	}

	/**
	 * Convert to ExpeditionData for packets
	 * Note: durationMinutes uses the actual expedition duration (after speed adjustment)
	 * The rewardIndex is stored separately and used directly for reward calculations
	 */
	public toExpeditionData(): ExpeditionData {
		const durationMinutes = this.getDurationMinutes();
		return {
			id: this.id.toString(),
			durationMinutes,
			displayDurationMinutes: Math.round(durationMinutes / 10) * 10,
			riskRate: this.riskRate,
			difficulty: this.difficulty,
			wealthRate: this.wealthRate,
			locationType: this.locationType as ExpeditionLocationType,
			mapLocationId: this.mapLocationId,
			isDistantExpedition: this.isDistantExpedition
		};
	}

	/**
	 * Convert to ExpeditionInProgressData for packets
	 */
	public toExpeditionInProgressData(petTypeId: number, petSex: string, petNickname?: string): ExpeditionInProgressData {
		const durationMinutes = this.getDurationMinutes();
		return {
			id: this.id.toString(),
			durationMinutes,
			displayDurationMinutes: Math.round(durationMinutes / 10) * 10,
			riskRate: this.riskRate,
			difficulty: this.difficulty,
			locationType: this.locationType as ExpeditionLocationType,
			mapLocationId: this.mapLocationId,
			startTime: this.startDate.getTime(),
			endTime: this.endDate.getTime(),
			status: this.status as ExpeditionStatus,
			petId: petTypeId,
			petSex,
			petNickname,
			foodConsumed: this.foodConsumed,
			isDistantExpedition: this.isDistantExpedition
		};
	}
}

export class PetExpeditions {
	/**
	 * Get the current expedition for a player (if any)
	 */
	static async getActiveExpeditionForPlayer(playerId: number): Promise<PetExpedition | null> {
		return await PetExpedition.findOne({
			where: {
				playerId,
				status: ExpeditionConstants.STATUS.IN_PROGRESS
			}
		});
	}

	/**
	 * Get expedition by ID
	 */
	static async getById(id: number): Promise<PetExpedition | null> {
		return await PetExpedition.findByPk(id);
	}

	/**
	 * Parameters for creating a new expedition
	 */
	static createExpedition(params: {
		playerId: number;
		petId: number;
		expeditionData: ExpeditionData;
		durationMinutes: number;
		foodConsumed: number;
		rewardIndex: number;
	}): PetExpedition {
		const {
			playerId, petId, expeditionData, durationMinutes, foodConsumed, rewardIndex
		} = params;
		const startDate = new Date();
		const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

		return PetExpedition.build({
			playerId,
			petId,
			startDate,
			endDate,
			riskRate: expeditionData.riskRate,
			difficulty: expeditionData.difficulty,
			wealthRate: expeditionData.wealthRate,
			locationType: expeditionData.locationType,
			mapLocationId: expeditionData.mapLocationId ?? 1,
			status: ExpeditionConstants.STATUS.IN_PROGRESS,
			foodConsumed,
			rewardIndex,
			isDistantExpedition: expeditionData.isDistantExpedition ?? false
		});
	}

	/**
	 * Cancel an expedition and remove it from the database
	 * Note: Cancelled expeditions are tracked in the logs database for analytics
	 */
	static async cancelExpedition(expedition: PetExpedition): Promise<void> {
		await expedition.destroy();
	}

	/**
	 * Recall a pet from expedition and remove the expedition from the database
	 * Note: Recalled expeditions are tracked in the logs database for analytics
	 */
	static async recallExpedition(expedition: PetExpedition): Promise<void> {
		await expedition.destroy();
	}

	/**
	 * Mark expedition as completed and remove it from the database
	 * Note: Completed expeditions are tracked in the logs database for analytics
	 */
	static async completeExpedition(expedition: PetExpedition): Promise<void> {
		await expedition.destroy();
	}
}

export function initModel(sequelize: Sequelize): void {
	PetExpedition.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		petId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		startDate: {
			type: DataTypes.DATE,
			allowNull: false
		},
		endDate: {
			type: DataTypes.DATE,
			allowNull: false
		},
		riskRate: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		difficulty: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		wealthRate: {
			type: DataTypes.FLOAT,
			allowNull: false
		},
		locationType: {
			type: DataTypes.STRING(32), // eslint-disable-line new-cap
			allowNull: false
		},
		mapLocationId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 1
		},
		status: {
			type: DataTypes.STRING(32), // eslint-disable-line new-cap
			allowNull: false,
			defaultValue: ExpeditionConstants.STATUS.IN_PROGRESS
		},
		foodConsumed: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		rewardIndex: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		},
		isDistantExpedition: {
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
		tableName: "pet_expeditions",
		freezeTableName: true
	});

	PetExpedition.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default PetExpedition;
