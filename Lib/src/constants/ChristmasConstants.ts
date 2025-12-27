/**
 * Constants for the Christmas bonus feature
 */
export abstract class ChristmasConstants {
	/**
	 * Delay in hours between announcement and bonus when both run immediately (4 hours)
	 */
	static readonly IMMEDIATE_DELAY_HOURS = 4;

	/**
	 * Schedule for the pre-announcement at 12:00 on December 25th
	 */
	static readonly PRE_ANNOUNCEMENT_SCHEDULE = {
		month: 12,
		day: 25,
		hour: 12
	};

	/**
	 * Schedule for the bonus at 16:00 on December 25th
	 */
	static readonly BONUS_SCHEDULE = {
		month: 12,
		day: 25,
		hour: 16
	};
}
