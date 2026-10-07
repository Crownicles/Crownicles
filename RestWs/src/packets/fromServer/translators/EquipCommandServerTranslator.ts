import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandEquipActionRes, CommandEquipErrorNoItem
} from "../../../../../Lib/src/packets/commands/CommandEquipPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { EquipActionRes } from "../../../../../WsPackets/src/fromServer/equip/EquipActionRes";
import { EquipNoItemRes } from "../../../../../WsPackets/src/fromServer/equip/EquipNoItemRes";
import { fromServerTranslator } from "../FromServerTranslator";

export default class EquipCommandServerTranslator {
	@fromServerTranslator(CommandEquipActionRes, EquipActionRes)
	public static action(_context: PacketContext, packet: CommandEquipActionRes): Promise<EquipActionRes> {
		return asyncMakeFromServerPacket(EquipActionRes, {
			success: packet.success,
			categories: packet.categories,
			...packet.error === undefined ? {} : { error: packet.error }
		});
	}

	@fromServerTranslator(CommandEquipErrorNoItem, EquipNoItemRes)
	public static noItem(_context: PacketContext, _packet: CommandEquipErrorNoItem): Promise<EquipNoItemRes> {
		return asyncMakeFromServerPacket(EquipNoItemRes, {});
	}
}
