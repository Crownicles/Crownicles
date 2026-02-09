import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandBlessingPacketReq, CommandBlessingPacketRes
} from "../../../../Lib/src/packets/commands/CommandBlessingPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { BlessingManager } from "../../core/blessings/BlessingManager";

export default class BlessingCommand {
	@commandRequires(CommandBlessingPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	execute(response: CrowniclesPacket[], _player: Player, _packet: CommandBlessingPacketReq, _context: PacketContext): void {
		const blessingManager = BlessingManager.getInstance();
		const topContributor = blessingManager.getTopContributor();

		response.push(makePacket(CommandBlessingPacketRes, {
			activeBlessingType: blessingManager.getActiveBlessingType(),
			blessingEndAt: blessingManager.getBlessingEndAt()?.getTime() ?? 0,
			poolAmount: blessingManager.getPoolAmount(),
			poolThreshold: blessingManager.getPoolThreshold(),
			lastTriggeredByKeycloakId: blessingManager.getLastTriggeredByKeycloakId() ?? "",
			topContributorKeycloakId: topContributor?.keycloakId ?? "",
			topContributorAmount: topContributor?.amount ?? 0,
			totalContributors: blessingManager.getTotalContributors(),
			poolExpiresAt: blessingManager.getPoolExpiresAt().getTime()
		}));
	}
}
