import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildShopEmpty, CommandGuildShopGiveXp,
	CommandGuildShopNoFoodStorageSpace
} from "../../../../../../Lib/src/packets/commands/CommandGuildShopPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandGuildShopEmpty, handleCommandGuildShopGiveXp,
	handleCommandGuildShopNoFoodStorageSpace
} from "../../../../commands/guild/GuildShopCommand";

export default class GuildShopCommandPacketHandlers {
	@packetHandler(CommandGuildShopNoFoodStorageSpace)
	async guildShopNoFoodStorageSpace(context: PacketContext, _packet: CommandGuildShopNoFoodStorageSpace): Promise<void> {
		await handleCommandGuildShopNoFoodStorageSpace(context);
	}

	@packetHandler(CommandGuildShopEmpty)
	async guildShopEmpty(context: PacketContext, _packet: CommandGuildShopEmpty): Promise<void> {
		await handleCommandGuildShopEmpty(context);
	}

	@packetHandler(CommandGuildShopGiveXp)
	async guildShopGiveXp(context: PacketContext, packet: CommandGuildShopGiveXp): Promise<void> {
		await handleCommandGuildShopGiveXp(packet, context);
	}
}
