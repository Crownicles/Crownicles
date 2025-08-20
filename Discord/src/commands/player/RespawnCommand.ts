import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandRespawnPacketReq,
	CommandRespawnPacketRes
} from "../../../../Lib/src/packets/commands/CommandRespawnPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { EmoteUtils } from "../../utils/EmoteUtils";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Get the respawn packet to send it to the server
 * @param interaction
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandRespawnPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandRespawnPacketReq, {});
}

/**
 * Handle the response to the respawn
 * @param packet
 * @param context
 */
export async function handleCommandRespawnPacketRes(packet: CommandRespawnPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	await interaction?.editReply({
		content: i18n.t("commands:respawn.response", {
			lng: interaction.userLanguage,
			respawnEmote: EmoteUtils.translateEmojiToDiscord(CrowniclesIcons.commands.respawn),
			scoreEmote: EmoteUtils.translateEmojiToDiscord(CrowniclesIcons.unitValues.score),
			pseudo: escapeUsername(interaction.user.displayName),
			count: packet.lostScore
		})
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("respawn"),
	getPacket,
	mainGuildCommand: false
};
