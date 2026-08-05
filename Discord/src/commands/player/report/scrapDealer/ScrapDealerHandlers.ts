import { CommandReportScrapDealerRecycleRes } from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { formatMaterialLoot } from "../../../../utils/MaterialLootDisplayUtils";
import { sendBlacksmithReply } from "../blacksmith/BlacksmithHandlers";

export async function handleScrapDealerRecycle(
	context: PacketContext,
	packet: CommandReportScrapDealerRecycleRes
): Promise<void> {
	const lng = context.discord!.language;
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.scrapDealer.recycleTitle",
		descriptionKey: "commands:report.city.scrapDealer.recycleSuccess",
		descriptionParams: {
			materialLoot: formatMaterialLoot(packet.materialLoot, lng),
			money: packet.moneyGained
		}
	});
}
