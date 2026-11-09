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
import { PlayerBadgesManager } from "../../database/game/models/PlayerBadges";
import { Badge } from "../../../../../Lib/src/types/Badge";

type AppStateChange = {
	seen: AppStateFlag[];
	acknowledged: number[];
	revealedBadges: Badge[];
};

const BADGES = new Set<string>(Object.values(Badge));

function isBadge(value: unknown): value is Badge {
	return typeof value === "string" && BADGES.has(value);
}

function isWholeNumber(value: unknown): value is number {
	return Number.isInteger(value);
}

/** An absent list is empty; anything else must be a list of known items only. */
function validList<Item>(value: unknown, isItem: (item: unknown) => item is Item): Item[] | null {
	const list = value ?? [];
	return Array.isArray(list) && list.every(isItem) ? list : null;
}

/** This packet comes over MQTT: only known flags, badges and whole ids may reach the database. */
function validChange(packet: CommandAppStateReq): AppStateChange | null {
	const seen = validList(packet.seen, isAppStateFlag);
	const acknowledged = validList(packet.acknowledged, isWholeNumber);
	const revealedBadges = validList(packet.revealedBadges, isBadge);
	if (seen === null || acknowledged === null) {
		return null;
	}
	return revealedBadges === null
		? null
		: {
			seen, acknowledged, revealedBadges
		};
}

function appStateResponse(info: PlayerMissionsInfo, unrevealedBadges: Badge[]): CommandAppStateRes {
	return makePacket(CommandAppStateRes, {
		seen: seenFlags(info.appSeen),
		reveals: pendingRevealsOf(info),
		unrevealedBadges
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
		await PlayerBadgesManager.markRevealedInApp(player.id, change.revealedBadges);
		const unrevealedBadges = await PlayerBadgesManager.getUnrevealedInApp(player.id);
		const info = await PlayerMissionsInfos.getOfPlayer(player.id);
		if (change.seen.length === 0 && change.acknowledged.length === 0) {
			response.push(appStateResponse(info, unrevealedBadges));
			return;
		}
		response.push(await PlayerMissionsInfo.withLocked(player.id, async locked => {
			await applyChangeUnderLock(locked, change);
			return appStateResponse(locked, unrevealedBadges);
		}));
	}
}
