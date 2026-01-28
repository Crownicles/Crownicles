import {
	DataTypes, Model, Sequelize
} from "sequelize";
import Player from "./Player";

// skipcq: JS-C1003 - moment does not expose itself as an ES Module.
import * as moment from "moment";

export class PlayerSmallEvent extends Model {
	declare readonly id: number;

	declare readonly playerId: number;

	declare readonly eventType: string;

	declare time: number;

	declare updatedAt: Date;

	declare createdAt: Date;
}

export class PlayerSmallEvents {
	static createPlayerSmallEvent(playerId: number, eventType: string, time: number): PlayerSmallEvent {
		return PlayerSmallEvent.build({
			playerId,
			eventType,
			time
		});
	}

	static async getLastOfPlayer(playerId: number): Promise<PlayerSmallEvent | null> {
		const playerSmallEvents = await PlayerSmallEvents.getSmallEventsOfPlayer(playerId);
		if (!playerSmallEvents || playerSmallEvents.length === 0) {
			return null;
		}
		let mostRecent = playerSmallEvents[0];
		for (const smallEvent of playerSmallEvents) {
			if (smallEvent.id >= mostRecent.id) {
				mostRecent = smallEvent;
			}
		}
		return mostRecent;
	}

	static async calculateCurrentScore(player: Player): Promise<number> {
		const numberOfSmallEventsDone = await PlayerSmallEvent.count({
			where: { playerId: player.id }
		});
		const tripDuration = player.getCurrentTripDuration();
		if (tripDuration === null) {
			return 0;
		}
		let somme = 0;
		for (let i = 1; i <= numberOfSmallEventsDone; i++) {
			/*
			 * By Pokegali Le sang (et romain22222 pour sa tentative)
			 * Vive la tangente hyperbolique
			 */
			const init = 75 + ((tripDuration - 1) / 2) ** 2;
			somme += Math.floor(init * Math.tanh(-(i - 1) / (tripDuration ** 0.75 * 2)) + init + 5);
		}
		return somme;
	}

	static async removeSmallEventsOfPlayer(playerId: number): Promise<void> {
		await PlayerSmallEvent.destroy({ where: { playerId } });
	}

	static async getSmallEventsOfPlayer(playerId: number): Promise<PlayerSmallEvent[]> {
		return await PlayerSmallEvent.findAll({
			where: { playerId }
		});
	}

	static async playerSmallEventCount(playerId: number, smallEventId: string): Promise<number> {
		return await PlayerSmallEvent.count({
			where: {
				playerId,
				eventType: smallEventId
			}
		});
	}
}

export function initModel(sequelize: Sequelize): void {
	PlayerSmallEvent.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		playerId: { type: DataTypes.INTEGER },
		eventType: { type: DataTypes.TEXT },
		time: { type: DataTypes.BIGINT },
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
		tableName: "player_small_events",
		freezeTableName: true
	});

	PlayerSmallEvent.beforeSave(instance => {
		instance.updatedAt = moment()
			.toDate();
	});
}

export default PlayerSmallEvent;
