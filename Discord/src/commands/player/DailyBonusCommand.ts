import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandDailyBonusPacketReq,
	CommandDailyBonusPacketRes
} from "../../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import i18n from "../../translations/i18n";
import {
	hoursToMilliseconds, minutesDisplay, printTimeBeforeDate
} from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ItemConstants, ItemNature
} from "../../../../Lib/src/constants/ItemConstants";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Get the daily bonus packet to send to the server
 * @param interaction
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandDailyBonusPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandDailyBonusPacketReq, {});
}

/**
 * Handle daily bonus cooldown error
 * @param context
 * @param lastDailyTimestamp
 * @param cooldownTime
 */
export async function handleDailyBonusCooldownError(context: PacketContext, lastDailyTimestamp: number, cooldownTime: number): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	await interaction?.editReply({
		embeds: [
			new CrowniclesErrorEmbed(
				interaction.user,
				context,
				interaction,
				i18n.t("commands:daily.errors.cooldown", {
					cooldownTime,
					time: printTimeBeforeDate(lastDailyTimestamp + hoursToMilliseconds(cooldownTime)),
					lng: interaction.userLanguage
				})
			)
		]
	});
}

/**
 * Handle daily bonus success
 * @param context
 * @param packet
 */
export async function handleDailyBonusRes(context: PacketContext, packet: CommandDailyBonusPacketRes): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:daily.title", {
					pseudo: escapeUsername(interaction.user.displayName),
					lng
				}), interaction.user)
				.setDescription(
					i18n.t("commands:daily.description", {
						value: packet.itemNature === ItemNature.TIME_SPEEDUP ? minutesDisplay(packet.value, lng) : packet.value,
						nature: ItemConstants.NATURE_ID_TO_NAME[packet.itemNature],
						lng
					})
				)
		]
	});
}


export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("daily"),
	getPacket,
	mainGuildCommand: false
};
