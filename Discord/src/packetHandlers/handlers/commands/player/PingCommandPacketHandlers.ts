import { packetHandler } from "../../../PacketHandler";
import { CommandPingPacketRes } from "../../../../../../Lib/src/packets/commands/CommandPingPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../../bot/DiscordCache";
import i18n from "../../../../translations/i18n";
import {
	crowniclesClient, shardId
} from "../../../../bot/CrowniclesShard";

export default class PingCommandPacketHandlers {
	@packetHandler(CommandPingPacketRes)
	async pingRes(context: PacketContext, packet: CommandPingPacketRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		await interaction?.editReply({
			content: i18n.t("commands:ping.discord.edit", {
				lng: interaction?.userLanguage,
				totalLatency: Date.now() - packet.clientTime,
				discordApiLatency: crowniclesClient!.ws.ping,
				shardId,
				totalShards: crowniclesClient!.shard!.count - 1
			})
		});
	}
}
