import {
	CommandRarityPacketReq, CommandRarityPacketRes
} from "../../../../Lib/src/packets/commands/CommandRarityPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ItemConstants } from "../../../../Lib/src/constants/ItemConstants";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";

export default class RarityCommand {
	@commandRequires(CommandRarityPacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	execute(response: CrowniclesPacket[]): void {
		const maxValue = ItemConstants.RARITY.GENERATOR.MAX_VALUE;
		const raritiesGenerator = ItemConstants.RARITY.GENERATOR.VALUES;
		response.push(makePacket(CommandRarityPacketRes, {
			rarities: [
				0,
				raritiesGenerator[0] * 100 / maxValue,
				(raritiesGenerator[1] - raritiesGenerator[0]) * 100 / maxValue,
				(raritiesGenerator[2] - raritiesGenerator[1]) * 100 / maxValue,
				(raritiesGenerator[3] - raritiesGenerator[2]) * 100 / maxValue,
				(raritiesGenerator[4] - raritiesGenerator[3]) * 100 / maxValue,
				(raritiesGenerator[5] - raritiesGenerator[4]) * 100 / maxValue,
				(raritiesGenerator[6] - raritiesGenerator[5]) * 100 / maxValue,
				(maxValue - raritiesGenerator[6]) * 100 / maxValue
			]
		}));
	}
}
