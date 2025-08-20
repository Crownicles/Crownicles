import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import {
	CommandGuildStoragePacketReq,
	CommandGuildStoragePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildStoragePacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";

function getPacket(): CommandGuildStoragePacketReq {
	return makePacket(CommandGuildStoragePacketReq, {});
}

export async function handleSuccess(packet: CommandGuildStoragePacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.setTitle(i18n.t("commands:guildStorage.embed.title", {
			lng,
			guildName: packet.guildName
		}))
		.setThumbnail(GuildConstants.ICON)
		.addFields({
			name: i18n.t("commands:guildStorage.embed.descriptionTitle", { lng }),
			value: i18n.t("commands:guildStorage.embed.description", { lng })
		});
	for (const food of packet.foods) {
		embed.addFields({
			name: i18n.t("commands:guildStorage.food.title", {
				lng,
				foodId: food.id
			}),
			value: i18n.t("commands:guildStorage.food.description", {
				lng,
				amount: food.amount,
				maxAmount: food.maxAmount
			}),
			inline: true
		});
	}
	await interaction.reply({ embeds: [embed] });
}


export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildStorage"),
	getPacket,
	mainGuildCommand: false
};
