import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { datesAreOnSameDay } from "../../../../../../Lib/src/utils/TimeUtils";
import { MissionsController } from "../../../missions/MissionsController";
import PlayerMissionsInfo from "./PlayerMissionsInfo";
import { crowniclesInstance } from "../../../../index";
import { MissionDataController } from "../../../../data/Mission";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class DailyMission extends Model {
	declare readonly id: number;

	declare missionId: string;

	declare missionObjective: number;

	declare missionVariant: number;

	declare gemsToWin: number;

	declare xpToWin: number;

	declare pointsToWin: number;

	declare moneyToWin: number;

	declare lastDate: Date;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class DailyMissions {
	static async queryDailyMission(): Promise<DailyMission> {
		return await DailyMission.findOne();
	}

	/**
	 * Get the daily mission of the player or generate a new one if it doesn't exist or if the last date is not today
	 */
	static async getOrGenerate(): Promise<DailyMission> {
		let dailyMission = await DailyMissions.queryDailyMission();
		if (!dailyMission || !datesAreOnSameDay(dailyMission.lastDate, new Date())) {
			await PlayerMissionsInfo.update({
				dailyMissionNumberDone: 0,
				dailyMissionBlob: null
			}, { where: {} });
			dailyMission = await DailyMissions.regenerateDailyMission();
		}
		return dailyMission;
	}

	static async regenerateDailyMission(): Promise<DailyMission> {
		const prop = MissionsController.generateRandomDailyMissionProperties();
		let dailyMission = await DailyMissions.queryDailyMission();
		const missionData = MissionDataController.instance.getById(prop.mission.id);
		if (dailyMission) {
			dailyMission.missionId = prop.mission.id;
			dailyMission.missionObjective = missionData.objectives[prop.index];
			dailyMission.missionVariant = prop.variant;
			dailyMission.pointsToWin = missionData.points[prop.index];
			dailyMission.gemsToWin = missionData.gems[prop.index];
			dailyMission.xpToWin = missionData.xp[prop.index];
			dailyMission.moneyToWin = missionData.money[prop.index];
			dailyMission.lastDate = new Date();
			await dailyMission.save();
		}
		else {
			dailyMission = await DailyMission.create({
				id: 0,
				missionId: prop.mission.id,
				missionObjective: missionData.objectives[prop.index],
				missionVariant: prop.variant,
				pointsToWin: missionData.points[prop.index],
				gemsToWin: missionData.gems[prop.index],
				xpToWin: missionData.xp[prop.index],
				moneyToWin: missionData.money[prop.index],
				lastDate: new Date()
			}, { returning: true });
		}
		crowniclesInstance.logsDatabase.logMissionDailyRefreshed(dailyMission.missionId, dailyMission.missionVariant, dailyMission.missionObjective)
			.then();
		return await this.queryDailyMission();
	}
}

export function initModel(sequelize: Sequelize): void {
	DailyMission.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		missionId: { type: DataTypes.TEXT },
		missionObjective: {
			type: DataTypes.INTEGER
		},
		missionVariant: {
			type: DataTypes.INTEGER
		},
		gemsToWin: { type: DataTypes.INTEGER },
		pointsToWin: {
			type: DataTypes.INTEGER
		},
		xpToWin: { type: DataTypes.INTEGER },
		moneyToWin: { type: DataTypes.INTEGER },
		lastDate: { type: DataTypes.DATE },
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
		tableName: "daily_mission",
		freezeTableName: true
	});

	DailyMission.beforeSave(instance => {
		instance.updatedAt = new Date();
	});
}

export default DailyMission;
