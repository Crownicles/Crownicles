import { packetHandler } from "../../../PacketHandler";
import {
	CommandUnlockAcceptPacketRes,
	CommandUnlockHimself,
	CommandUnlockNoPlayerFound,
	CommandUnlockNotEnoughMoney,
	CommandUnlockNotInJail,
	CommandUnlockRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandUnlockPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	handleCommandUnlockAcceptPacketRes,
	handleCommandUnlockNotEnoughMoneyError,
	handleCommandUnlockRefusePacketRes
} from "../../../../commands/player/UnlockCommand";

export default class UnlockCommandPacketHandlers {
	@packetHandler(CommandUnlockHimself)
	async unlockHimself(context: PacketContext, _packet: CommandUnlockHimself): Promise<void> {
		await handleClassicError(context, "commands:unlock.himself");
	}

	@packetHandler(CommandUnlockNotInJail)
	async unlockNotInJail(context: PacketContext, _packet: CommandUnlockNotInJail): Promise<void> {
		await handleClassicError(context, "commands:unlock.notInJail");
	}

	@packetHandler(CommandUnlockNoPlayerFound)
	async unlockNoPlayerFound(context: PacketContext, _packet: CommandUnlockNoPlayerFound): Promise<void> {
		await handleClassicError(context, "error:playerDoesntExist", {}, { ephemeral: true });
	}

	@packetHandler(CommandUnlockNotEnoughMoney)
	async unlockNotEnoughMoney(context: PacketContext, packet: CommandUnlockNotEnoughMoney): Promise<void> {
		await handleCommandUnlockNotEnoughMoneyError(packet, context);
	}

	@packetHandler(CommandUnlockRefusePacketRes)
	async unlockRefuseRes(context: PacketContext, _packet: CommandUnlockRefusePacketRes): Promise<void> {
		await handleCommandUnlockRefusePacketRes(context);
	}

	@packetHandler(CommandUnlockAcceptPacketRes)
	async unlockAcceptRes(context: PacketContext, packet: CommandUnlockAcceptPacketRes): Promise<void> {
		await handleCommandUnlockAcceptPacketRes(packet, context);
	}
}
