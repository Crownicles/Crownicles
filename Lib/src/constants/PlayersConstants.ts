import {Effect} from "../types/Effect";
import {NotificationsConstants} from "./NotificationsConstants";

export abstract class PlayersConstants {
	static readonly PLAYER_DEFAULT_VALUES = {
		SCORE: 0,
		WEEKLY_SCORE: 0,
		LEVEL: 0,
		EXPERIENCE: 0,
		MONEY: 0,
		CLASS: 0,
		BADGES: null as unknown as string,
		GUILD_ID: null as unknown as number,
		LAST_PET_FREE: new Date(0),
		EFFECT: Effect.NOT_STARTED.id,
		EFFECT_DURATION: Effect.NOT_STARTED.timeMinutes,
		START_TRAVEL_DATE: 0,
		NOTIFICATIONS: NotificationsConstants.DM_VALUE
	};
}