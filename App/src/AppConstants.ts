export abstract class AppConstants {
	static readonly PACKET_TIMEOUT = 20000; // 20 seconds

	// How long a cached entity is served without asking the server again, when no action invalidated it
	static readonly GAME_STATE_STALE_TIME = 30000; // 30 seconds
}