export abstract class WebSocketConstants {
	/**
	 * Purge closed connections interval in milliseconds
	 */
	static readonly PURGE_INTERVAL = 30000;

	/**
	 * Ping interval in milliseconds: a socket silent for two of them is closed
	 */
	static readonly HEARTBEAT_INTERVAL = 30000;

	/**
	 * How many messages a socket may send while its token is being checked: the app sends its whole queue as soon as it connects
	 */
	static readonly MAX_HELD_MESSAGES = 32;

	/**
	 * How much a socket may send while its token is being checked, so an unknown client cannot pile up memory
	 */
	static readonly MAX_HELD_BYTES = 64 * 1024;
}
