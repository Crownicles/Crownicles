import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandLeagueRewardPacketReq,
	CommandLeagueRewardSuccessPacketRes
} from "../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import i18n from "../../translations/i18n";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Get the packet
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandLeagueRewardPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandLeagueRewardPacketReq, {});
}

export async function handleCommandLeagueRewardSuccessPacket(packet: CommandLeagueRewardSuccessPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:leagueReward.title", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t(`commands:leagueReward.description.${packet.rank === 1 ? "first" : "other"}`, {
					lng,
					score: packet.score,
					glory: packet.gloryPoints,
					rank: packet.rank,
					leagueId: packet.oldLeagueId,
					money: packet.money,
					xp: packet.xp
				}))
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("leagueReward"),
	getPacket,
	mainGuildCommand: false
};
