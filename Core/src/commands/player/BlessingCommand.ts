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
import { RequirementOracleNotMetPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementOracleNotMetPacket";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";

export default class BlessingCommand {
	@commandRequires(CommandBlessingPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandBlessingPacketReq, _context: PacketContext): Promise<void> {
		const altarEncounterCount = await LogsReadRequests.getSmallEventEncounterCount(player.keycloakId, "altar");
		if (altarEncounterCount === 0) {
			response.push(makePacket(RequirementOracleNotMetPacket, {}));
			return;
		}

		const blessingManager = BlessingManager.getInstance();
		const topContributor = blessingManager.getTopContributor();

		response.push(makePacket(CommandBlessingPacketRes, {
			activeBlessingType: blessingManager.getActiveBlessingType(),
			blessingEndAt: blessingManager.getBlessingEndAt()?.getTime(),
			poolAmount: blessingManager.getPoolAmount(),
			poolThreshold: blessingManager.getPoolThreshold(),
			lastTriggeredByKeycloakId: blessingManager.getLastTriggeredByKeycloakId() ?? undefined,
			topContributorKeycloakId: topContributor?.keycloakId,
			topContributorAmount: topContributor?.amount,
			totalContributors: blessingManager.getTotalContributors(),
			poolExpiresAt: blessingManager.getPoolExpiresAt().getTime()
		}));
	}
}
