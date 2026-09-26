import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorGuildReimburse } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildReimburse";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CommandReportGuildDomainDepositTreasuryReq } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorInstance } from "../utils/ReactionsCollector";
import { GuildFoodPurchase } from "./ReportCityFoodShopService";
import { handleGuildDomainDepositTreasury } from "./ReportCityGuildDomainShopService";

export function offerGuildFoodReimbursement(purchase: GuildFoodPurchase, context: PacketContext, response: CrowniclesPacket[]): void {
	const collector = new ReactionCollectorInstance(new ReactionCollectorGuildReimburse(purchase.amount), context, {
		allowedPlayerKeycloakIds: [context.keycloakId!], reactionLimit: 1
	}, async (collector, answers): Promise<void> => {
		if (collector.getFirstReaction()?.reaction.type !== ReactionCollectorAcceptReaction.name) {
			return;
		}
		await handleGuildDomainDepositTreasury(context.keycloakId!, makePacket(CommandReportGuildDomainDepositTreasuryReq, {
			amount: purchase.amount, expectedGuildId: purchase.guildId, isReimburse: true
		}), answers);
	});
	response.push(collector.build());
}
