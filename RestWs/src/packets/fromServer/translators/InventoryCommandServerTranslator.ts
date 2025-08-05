import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandInventoryPacketRes } from "../../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { InventoryRes } from "../../../../../WsPackets/src/fromServer/inventory/InventoryRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class InventoryCommandServerTranslator {
	@fromServerTranslator(CommandInventoryPacketRes, InventoryRes)
	public static translate(_context: PacketContext, packet: CommandInventoryPacketRes): Promise<InventoryRes> {
		return asyncMakeFromServerPacket(InventoryRes, {
			foundPlayer: packet.foundPlayer,
			data: packet.data
				? {
					armor: packet.data.armor,
					weapon: packet.data.weapon,
					potion: packet.data.potion,
					object: packet.data.object,
					backupArmors: packet.data.backupArmors,
					backupWeapons: packet.data.backupWeapons,
					backupPotions: packet.data.backupPotions,
					backupObjects: packet.data.backupObjects,
					slots: packet.data.slots
				}
				: undefined
		});
	}
}
