import { makePacket } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandAccountAdventuresReq, CommandAccountAdventuresRes
} from "../../../Lib/src/packets/commands/CommandAccountAdventuresPacket";
import { AccountAdventure } from "../../../Lib/src/types/AccountAdventure";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { ContextConstants } from "../constants/ContextConstants";
import { MqttManager } from "../mqtt/MqttManager";

/** The accounts are still shown without their progression past this: the choice must not wait on the game. */
const ADVENTURES_TIMEOUT_MS = 3_000;

/** Asks Core where the accounts stand; a refusal, a silence or a failure resolve to null, shown as an unknown progression rather than none. */
export function coreAccountAdventures(requesterId: string, accountIds: string[]): Promise<AccountAdventure[] | null> {
	return new Promise(resolve => {
		MqttManager.asyncPacketSender.sendPacketAndHandleResponse({
			frontEndOrigin: ContextConstants.FRONT_END_ORIGIN,
			frontEndSubOrigin: ContextConstants.FRONT_END_SUB_ORIGIN,
			keycloakId: requesterId,
			webSocket: {}
		}, makePacket(CommandAccountAdventuresReq, { keycloakIds: accountIds }), (_context, packetName, packet) => {
			resolve(packetName === CommandAccountAdventuresRes.name ? (packet as CommandAccountAdventuresRes).adventures : null);
		}, {
			timeoutMs: ADVENTURES_TIMEOUT_MS, onTimeout: () => resolve(null)
		})
			.catch((error: unknown) => {
				CrowniclesLogger.errorWithObj("Could not ask Core for the accounts progression", error);
				resolve(null);
			});
	});
}
