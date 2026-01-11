export abstract class BigEventConstants {
	static readonly EXPERIENCE = {
		/**
		 * Base XP given for completing a big event
		 */
		BASE: 172,

		/**
		 * Bonus XP for gaining health during the event
		 */
		HEALTH_BONUS: 230,

		/**
		 * Bonus XP for receiving a random item
		 */
		RANDOM_ITEM_BONUS: 345,

		/**
		 * Bonus XP for gaining money
		 */
		MONEY_BONUS: 115,

		/**
		 * XP penalty when receiving the OCCUPIED effect
		 */
		OCCUPIED_PENALTY: 125,

		/**
		 * XP penalty when receiving SLEEPING or STARVING effect
		 */
		SLEEPING_STARVING_PENALTY: 130,

		/**
		 * XP penalty when receiving CONFOUNDED effect
		 */
		CONFOUNDED_PENALTY: 140
	};
}
