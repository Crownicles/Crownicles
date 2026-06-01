import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import {
	InteractOtherPlayerInteraction, SmallEventInteractOtherPlayersAcceptToGivePoorPacket, SmallEventInteractOtherPlayersPacket, SmallEventInteractOtherPlayersRefuseToGivePoorPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import {
	handleEffectInteraction, handleNoPlayerInteraction, handleOtherInteractions, interactOtherPlayerGetPlayerDisplay
} from "../../../smallEvents/interactOtherPlayers";

export default class InteractOtherPlayersSmallEventHandler {
	@packetHandler(SmallEventInteractOtherPlayersPacket)
	async smallEventInteractOtherPlayers(context: PacketContext, packet: SmallEventInteractOtherPlayersPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		if (!packet.keycloakId) {
			await handleNoPlayerInteraction(interaction, lng);
			return;
		}

		if (!packet.data) {
			throw new Error("No packet data defined in InteractOtherPlayers small event");
		}

		const playerDisplay = await interactOtherPlayerGetPlayerDisplay(packet.keycloakId, packet.data.rank, lng);

		if (packet.playerInteraction === InteractOtherPlayerInteraction.EFFECT) {
			await handleEffectInteraction(interaction, packet, lng, playerDisplay);
			return;
		}

		await handleOtherInteractions(interaction, packet, lng, playerDisplay);
	}


	@packetHandler(SmallEventInteractOtherPlayersAcceptToGivePoorPacket)
	async smallEventInteractOtherPlayersAcceptToGivePoor(context: PacketContext, _packet: SmallEventInteractOtherPlayersAcceptToGivePoorPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		const lng = context.discord!.language;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"interactOtherPlayers",
					StringUtils.getRandomTranslation("smallEvents:interactOtherPlayers.poor_give_money", lng),
					interaction.user,
					lng
				)
			]
		});
	}


	@packetHandler(SmallEventInteractOtherPlayersRefuseToGivePoorPacket)
	async smallEventInteractOtherPlayersRefuseToGivePoor(context: PacketContext, _packet: SmallEventInteractOtherPlayersRefuseToGivePoorPacket): Promise<void> {
		const interaction = context.discord!.buttonInteraction ? DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!) : DiscordCache.getInteraction(context.discord!.interaction!);
		const lng = context.discord!.language;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"interactOtherPlayers",
					StringUtils.getRandomTranslation("smallEvents:interactOtherPlayers.poor_dont_give_money", lng),
					interaction!.user,
					lng
				)
			]
		});
	}
}
