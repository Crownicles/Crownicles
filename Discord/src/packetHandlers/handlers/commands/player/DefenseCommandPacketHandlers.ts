import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandDefenseCancelPacketRes,
	CommandDefenseChangeSuccessPacketRes,
	CommandDefenseNoChoicePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandDefensePacket";
import { handleCommandDefenseChangeSuccessPacket } from "../../../../commands/player/DefenseCommand";
import i18n from "../../../../translations/i18n";

export default class DefenseCommandPacketHandlers {
	@packetHandler(CommandDefenseNoChoicePacketRes)
	async defenseNoChoice(context: PacketContext, packet: CommandDefenseNoChoicePacketRes): Promise<void> {
		await handleClassicError(context, "commands:defense.noChoice", {
			className: i18n.t(`models:classes.${packet.classId}`, { lng: context.discord!.language })
		});
	}

	@packetHandler(CommandDefenseCancelPacketRes)
	async defenseCancel(context: PacketContext, _packet: CommandDefenseCancelPacketRes): Promise<void> {
		await handleClassicError(context, "commands:defense.canceled");
	}

	@packetHandler(CommandDefenseChangeSuccessPacketRes)
	async defenseChangeSuccess(context: PacketContext, packet: CommandDefenseChangeSuccessPacketRes): Promise<void> {
		await handleCommandDefenseChangeSuccessPacket(context, packet);
	}
}
