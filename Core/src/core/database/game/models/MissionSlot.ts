import {
	DataTypes, Model, Sequelize
} from "sequelize";
import {
	BaseMission, MissionType
} from "../../../../../../Lib/src/types/CompletedMission";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";
import missionJson = require("../../../../../resources/campaign.json");

export class MissionSlot extends Model {
	declare readonly id: number;

	declare readonly playerId: number;

	declare missionId: string;

	declare missionVariant: number;

	declare missionObjective: number;

	declare expiresAt: Date;

	declare numberDone: number;

	declare gemsToWin: number;

	declare xpToWin: number;

	declare pointsToWin: number;

	declare moneyToWin: number;

	declare updatedAt: Date;

	declare createdAt: Date;

	declare saveBlob: Buffer;


	public isCompleted(): boolean {
		return this.numberDone >= this.missionObjective;
	}

	public isCampaign(): boolean {
		return this.expiresAt === null;
	}

	public hasExpired(): boolean {
		return this.expiresAt !== null && this.expiresAt < new Date();
	}

	public toBaseMission(): BaseMission {
		return {
			missionId: this.missionId,
			missionObjective: this.missionObjective,
			missionVariant: this.missionVariant,
			numberDone: this.numberDone,
			saveBlob: this.saveBlob?.toString("binary"),
			missionType: this.isCampaign() ? MissionType.CAMPAIGN : MissionType.NORMAL,
			expiresAt: this.expiresAt?.toISOString()
		};
	}
}

export class MissionSlots {
	static getById(id: number): Promise<MissionSlot> {
		return Promise.resolve(MissionSlot.findOne(
			{
				rejectOnEmpty: true,
				where: { id }
			}
		));
	}

	static async getOfPlayer(playerId: number): Promise<MissionSlot[]> {
		const missionSlots = await MissionSlot.findAll({
			where: { playerId }
		});
		if (missionSlots.length === 0) {
			return [
				await MissionSlot.create({
					...missionJson.missions[0],
					playerId
				})
			];
		}
		return missionSlots;
	}

	static async getCampaignOfPlayer(playerId: number): Promise<MissionSlot> {
		return await MissionSlot.findOne({
			rejectOnEmpty: false,
			where: {
				playerId,
				expiresAt: null
			}
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	MissionSlot.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		playerId: { type: DataTypes.INTEGER },
		missionId: { type: DataTypes.TEXT },
		missionVariant: {
			type: DataTypes.INTEGER
		},
		missionObjective: {
			type: DataTypes.INTEGER
		},
		expiresAt: {
			type: DataTypes.DATE,
			defaultValue: null
		},
		numberDone: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		pointsToWin: {
			type: DataTypes.INTEGER
		},
		gemsToWin: { type: DataTypes.INTEGER },
		xpToWin: { type: DataTypes.INTEGER },
		moneyToWin: { type: DataTypes.INTEGER },
		updatedAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		createdAt: {
			type: DataTypes.DATE,
			defaultValue: moment()
				.format("YYYY-MM-DD HH:mm:ss")
		},
		saveBlob: {
			type: DataTypes.BLOB,
			defaultValue: null
		}
	}, {
		sequelize,
		tableName: "mission_slots",
		freezeTableName: true
	});

	MissionSlot.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default MissionSlot;
