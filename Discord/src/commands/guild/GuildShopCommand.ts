import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildShopGiveXp,
	CommandGuildShopPacketReq
} from "../../../../Lib/src/packets/commands/CommandGuildShopPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import {
	sendErrorMessage, SendManner
} from "../../utils/ErrorUtils";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";

function getPacket(): CommandGuildShopPacketReq {
	return makePacket(CommandGuildShopPacketReq, {});
}

export async function handleCommandGuildShopNoFoodStorageSpace(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, context, interaction, i18n.t("commands:guildShop.noFoodStorageSpace", { lng: interaction.userLanguage }), { sendManner: SendManner.FOLLOWUP });
	}
}

export async function handleCommandGuildShopEmpty(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, context, interaction, i18n.t("commands:guildShop.empty", { lng: interaction.userLanguage }), { sendManner: SendManner.FOLLOWUP });
	}
}

export async function handleCommandGuildShopGiveXp(packet: CommandGuildShopGiveXp, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:guildShop.giveXpTitle", { lng }), interaction.user)
				.setDescription(
					i18n.t("commands:guildShop.giveXp", {
						lng,
						xp: packet.xp
					})
				)
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildShop"),
	getPacket,
	mainGuildCommand: false
};
