import { packetHandler } from "../PacketHandler";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandAppStateReq, CommandAppStateRes
} from "../../../../../Lib/src/packets/commands/CommandAppStatePacket";
import {
	AppStateFlag, isAppStateFlag
} from "../../../../../Lib/src/types/AppState";
import { Players } from "../../database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../../database/game/models/PlayerMissionsInfo";
import {
	pendingRevealsOf, seenFlags, storePendingReveals, withSeen
} from "../../appState/AppState";
import { PacketUtils } from "../../utils/PacketUtils";

type AppStateChange = {
	seen: AppStateFlag[];
	acknowledged: number[];
};

/** This packet comes over MQTT: only known flags and whole ids may reach the database. */
function validChange(packet: CommandAppStateReq): AppStateChange | null {
	const seen = packet.seen ?? [];
	const acknowledged = packet.acknowledged ?? [];
	if (!Array.isArray(seen) || !Array.isArray(acknowledged)) {
		return null;
	}
	if (!seen.every(isAppStateFlag) || !acknowledged.every(Number.isInteger)) {
		return null;
	}
	return {
		seen, acknowledged
	};
}

function appStateResponse(info: PlayerMissionsInfo): CommandAppStateRes {
	return makePacket(CommandAppStateRes, {
		seen: seenFlags(info.appSeen),
		reveals: pendingRevealsOf(info)
	});
}

async function applyChangeUnderLock(info: PlayerMissionsInfo, change: AppStateChange): Promise<void> {
	const acknowledged = new Set(change.acknowledged);
	info.appSeen = withSeen(info.appSeen, change.seen);
	storePendingReveals(info, pendingRevealsOf(info).filter(reveal => !acknowledged.has(reveal.id)));
	await info.save();
}

export default class AppStateHandlers {
	@packetHandler(CommandAppStateReq)
	async appState(response: CrowniclesPacket[], context: PacketContext, packet: CommandAppStateReq): Promise<void> {
		const change = validChange(packet);
		if (!change) {
			PacketUtils.pushInternalError(response, "Invalid app state change");
			return;
		}
		const player = await Players.getOrRegister(context.keycloakId!);
		const info = await PlayerMissionsInfos.getOfPlayer(player.id);
		if (change.seen.length === 0 && change.acknowledged.length === 0) {
			response.push(appStateResponse(info));
			return;
		}
		response.push(await PlayerMissionsInfo.withLocked(player.id, async locked => {
			await applyChangeUnderLock(locked, change);
			return appStateResponse(locked);
		}));
	}
}
