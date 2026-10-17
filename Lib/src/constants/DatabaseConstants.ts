import { DatabasePoolConfiguration } from "../database/DatabaseConfiguration";
import { asSeconds } from "../types/TimeTypes";
import { secondsToMilliseconds } from "../utils/TimeUtils";

/*
 * Sized from the `crownicles_db_pool_*` gauges: over 30 days the game pool sat at its former
 * implicit max of 5 with up to 9 queries waiting, the logs pool reached 3 used + 3 waiting.
 * Worst case for all services stays far below MariaDB `max_connections` (151, peak usage 34).
 */
const POOL_DEFAULTS = {
	min: 0,
	acquire: secondsToMilliseconds(asSeconds(60)),
	idle: secondsToMilliseconds(asSeconds(10))
};

export abstract class DatabaseConstants {
	static readonly POOLS = {
		GAME: {
			max: 20,
			...POOL_DEFAULTS
		},
		LOGS: {
			max: 10,
			...POOL_DEFAULTS
		},

		// One pool per Discord shard process
		DISCORD: {
			max: 5,
			...POOL_DEFAULTS
		}
	} as const satisfies Record<string, DatabasePoolConfiguration>;
}
