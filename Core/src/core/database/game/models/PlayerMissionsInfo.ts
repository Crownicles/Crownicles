import {
	DataTypes, Model, Sequelize
} from "sequelize";
import { datesAreOnSameDay } from "../../../../../../Lib/src/utils/TimeUtils";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import { crowniclesInstance } from "../../../../index";
import { Campaign } from "../../../missions/Campaign";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";
import { MissionsController } from "../../../missions/MissionsController";
import { Players } from "./Player";
import { CrowniclesPacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";

export class PlayerMissionsInfo extends Model {
	declare readonly playerId: number;

	declare gems: number;

	declare hasBoughtPointsThisWeek: boolean;

	declare dailyMissionNumberDone: number;

	declare lastDailyMissionCompleted: Date;

	declare dailyMissionBlob: Buffer;

	declare campaignProgression: number;

	declare campaignBlob: string;

	declare updatedAt: Date;

	declare createdAt: Date;

	static async resetShopBuyout(): Promise<void> {
		await PlayerMissionsInfo.update({
			hasBoughtPointsThisWeek: false
		}, { where: {} });
	}

	public hasCompletedDailyMission(): boolean {
		return this.lastDailyMissionCompleted && datesAreOnSameDay(this.lastDailyMissionCompleted, new Date());
	}

	public async addGems(amount: number, keycloakId: string, reason: NumberChangeReason): Promise<void> {
		this.gems += amount;
		await this.save();
		crowniclesInstance.logsDatabase.logGemsChange(keycloakId, this.gems, reason)
			.then();
	}

	public async spendGems(amount: number, response: CrowniclesPacket[], reason: NumberChangeReason): Promise<void> {
		const player = await Players.getById(this.playerId);
		await this.addGems(-amount, player.keycloakId, reason);
		await MissionsController.update(player, response, { missionId: "spendGems" });
	}
}

/**
 * This class is used to treat the missions of a player
 */
export class PlayerMissionsInfos {
	/**
	 * Get the missions of a player
	 * @param playerId
	 */
	public static async getOfPlayer(playerId: number): Promise<PlayerMissionsInfo> {
		const missionsInfo = (await PlayerMissionsInfo.findOrCreate({
			where: { playerId }
		}))[0];
		if (!missionsInfo.campaignBlob) {
			missionsInfo.campaignBlob = Campaign.getDefaultCampaignBlob();
		}
		return missionsInfo;
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerMissionsInfo.init({
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		gems: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		hasBoughtPointsThisWeek: {
			type: DataTypes.BOOLEAN,
			defaultValue: false
		},
		dailyMissionNumberDone: {
			type: DataTypes.INTEGER,
			defaultValue: 0
		},
		lastDailyMissionCompleted: {
			type: DataTypes.DATE,
			defaultValue: null
		},
		dailyMissionBlob: {
			type: DataTypes.BLOB,
			allowNull: true
		},
		campaignProgression: {
			type: DataTypes.INTEGER,
			defaultValue: 1
		},
		campaignBlob: {
			type: DataTypes.STRING
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
		tableName: "player_missions_info",
		freezeTableName: true
	});

	PlayerMissionsInfo.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default PlayerMissionsInfo;
