import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { CommandBlessingPacketReq } from "../../../../Lib/src/packets/commands/CommandBlessingPacketReq";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { CommandBlessingPacketRes } from "../../../../Lib/src/packets/commands/CommandBlessingPacketRes";
import { BlessingManager } from "../../core/blessings/BlessingManager";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";

export default class BlessingCommand {
	@commandRequires(CommandBlessingPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandBlessingPacketReq, _context: PacketContext): Promise<void> {
		const blessingManager = BlessingManager.getInstance();

		// Check if player can claim daily bonus
		let canClaimDailyBonus = false;
		if (blessingManager.canPlayerClaimDailyBonus(player.keycloakId)) {
			const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
			canClaimDailyBonus = missionInfo.hasCompletedDailyMission();
		}

		response.push(makePacket(CommandBlessingPacketRes, {
			activeBlessingType: blessingManager.getActiveBlessingType(),
			blessingEndAt: blessingManager.getBlessingEndAt()?.getTime() ?? 0,
			poolAmount: blessingManager.getPoolAmount(),
			poolThreshold: blessingManager.getPoolThreshold(),
			lastTriggeredByKeycloakId: blessingManager.getLastTriggeredByKeycloakId() ?? "",
			canClaimDailyBonus
		}));
	}
}
