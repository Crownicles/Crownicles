import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { SlashCommandBuilder } from "@discordjs/builders";
import {
	CommandPetNickPacketReq,
	CommandPetNickPacketRes
} from "../../../../Lib/src/packets/commands/CommandPetNickPacket";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Change the nickname of a player pet.
 */
function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): CommandPetNickPacketReq {
	const newNameOption = interaction.options.get("nickname");

	let newNickname;
	if (newNameOption) {
		newNickname = <string>newNameOption.value;
	}

	return makePacket(CommandPetNickPacketReq, {
		keycloakId: keycloakUser.id,
		newNickname
	});
}


export async function handleCommandPetNickPacketRes(packet: CommandPetNickPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;

	if (!packet.foundPet) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:petDoesntExist", { lng })
				)
			]
		});
		return;
	}

	if (!packet.nickNameIsAcceptable) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:petNickNotValid", {
						lng,
						min: PetConstants.NICKNAME_LENGTH_RANGE.MIN,
						max: PetConstants.NICKNAME_LENGTH_RANGE.MAX
					})
				)
			]
		});
		return;
	}

	if (!packet.newNickname) {
		await interaction.reply({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("commands:petNick.successTitle", {
						lng,
						pseudo: escapeUsername(interaction.user.displayName)
					}), interaction.user)
					.setDescription(i18n.t("commands:petNick.successNoName", { lng }))
			]
		});
		return;
	}
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:petNick.successTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t("commands:petNick.success", {
					lng,
					name: packet.newNickname
				}))
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("petNick")
		.addStringOption(option =>
			SlashCommandBuilderGenerator.generateOption("petNick", "nickname", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
