import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandAppStateRes } from "../../../../../Lib/src/packets/commands/CommandAppStatePacket";
import { PendingReveal as LibPendingReveal } from "../../../../../Lib/src/types/AppState";
import {
	AppStateRes, PendingReveal
} from "../../../../../WsPackets/src/fromServer/appState/AppStateRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import MissionsCompletedServerTranslator from "./MissionsCompletedServerTranslator";
import RoyalLetterServerTranslator from "./RoyalLetterServerTranslator";

async function revealOf(context: PacketContext, reveal: LibPendingReveal): Promise<PendingReveal> {
	return {
		id: reveal.id,
		...reveal.missions ? { missions: await MissionsCompletedServerTranslator.translate(context, reveal.missions) } : {},
		...reveal.letter ? { letter: await RoyalLetterServerTranslator.translate(context, reveal.letter) } : {}
	};
}

export default class AppStateServerTranslator {
	@fromServerTranslator(CommandAppStateRes, AppStateRes)
	public static async translate(context: PacketContext, packet: CommandAppStateRes): Promise<AppStateRes> {
		return asyncMakeFromServerPacket(AppStateRes, {
			seen: packet.seen,
			reveals: await Promise.all(packet.reveals.map(reveal => revealOf(context, reveal)))
		});
	}
}
