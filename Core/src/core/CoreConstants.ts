import { ChangeBlockingReasonPacket } from "../../../Lib/src/packets/utils/ChangeBlockingReasonPacket";
import { ReactionCollectorResetTimerPacketReq } from "../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { CommandPingPacketReq } from "../../../Lib/src/packets/commands/CommandPingPacket";
import { ReactionCollectorReactPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";

export abstract class CoreConstants {
	static BYPASS_MAINTENANCE_AND_RESETS_PACKETS = [
		ReactionCollectorReactPacket.name,
		ChangeBlockingReasonPacket.name,
		ReactionCollectorResetTimerPacketReq.name,
		CommandPingPacketReq.name
	];

	static OPENING_LINE = "Crownicles Core";

	/**
	 * Env var that overrides the base directory used by
	 * {@link GameDatabase} to locate model and migration files. Set by
	 * the integration test setup to point at the compiled `dist/` tree
	 * (the production loader only accepts `.js` files). Left unset in
	 * production.
	 */
	static DB_BASE_DIR_ENV_VAR = "CROWNICLES_DB_BASE_DIR";
}
