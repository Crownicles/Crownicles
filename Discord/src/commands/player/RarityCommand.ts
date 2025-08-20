import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandRarityPacketReq, CommandRarityPacketRes
} from "../../../../Lib/src/packets/commands/CommandRarityPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { ICommand } from "../ICommand";

function getPacket(): CommandRarityPacketReq {
	return makePacket(CommandRarityPacketReq, {});
}

export async function handleCommandRarityPacketRes(packet: CommandRarityPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:rarity.title", { lng }))
				.setDescription(packet.rarities.map((r, i) => i18n.t("commands:rarity.rarityTemplate", {
					lng,
					rarity: i,
					percentageOrDescription: i === 0 ? i18n.t("commands:rarity.earlyAvailable", { lng }) : `${r}%`
				}))
					.join("\n"))
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("rarity"),
	getPacket,
	mainGuildCommand: false
};
