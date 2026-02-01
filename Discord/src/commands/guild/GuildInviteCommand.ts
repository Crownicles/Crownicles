import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction.js";
import {
	CommandGuildInviteAcceptPacketRes,
	CommandGuildInviteErrorPacket,
	CommandGuildInvitePacketReq,
	CommandGuildInviteRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildInvitePacket.js";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils.js";
import {
	crowniclesClient, keycloakConfig
} from "../../bot/CrowniclesShard.js";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed.js";
import i18n from "../../translations/i18n.js";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket.js";
import { DiscordCache } from "../../bot/DiscordCache.js";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed.js";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils.js";
import { ReactionCollectorGuildInvitePacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildInvite.js";
import { ICommand } from "../ICommand.js";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants.js";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { PacketUtils } from "../../utils/PacketUtils";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { escapeUsername } from "../../../../Lib/src/utils/StringUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";

async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandGuildInvitePacketReq | null> {
	const invitedUser = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!invitedUser || !invitedUser.keycloakId) {
		return null;
	}

	return makePacket(CommandGuildInvitePacketReq, { invitedPlayerKeycloakId: invitedUser.keycloakId });
}

export async function handleCommandGuildInviteError(packet: CommandGuildInviteErrorPacket, context: PacketContext, errorKey: string): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const params = {
		embeds: [
			new CrowniclesErrorEmbed(
				interaction.user,
				context,
				interaction,
				i18n.t(errorKey, {
					level: GuildConstants.REQUIRED_LEVEL,
					guildName: packet.guildName,
					pseudo: await DisplayUtils.getEscapedUsername(packet.invitedPlayerKeycloakId, lng),
					lng
				})
			)
		]
	};
	if (buttonInteraction) {
		await buttonInteraction.editReply(params);
		return;
	}
	await interaction.reply(params);
}

export async function createGuildInviteCollector(context: PacketContext, packet: ReactionCollectorGuildInvitePacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data;
	const invitedUser = interaction.options.getUser("user")!;
	const invitedKeycloakId = await KeycloakUtils.getKeycloakIdFromDiscordId(keycloakConfig, invitedUser.id, null);
	if (invitedKeycloakId.isError || !invitedKeycloakId.payload.keycloakId) {
		return null;
	}

	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildInvite.title", {
		lng,
		pseudo: escapeUsername(invitedUser.displayName)
	}), invitedUser)
		.setDescription(
			i18n.t("commands:guildInvite.confirmDesc", {
				lng,
				guildName: data.guildName
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context, {
		acceptedUsersId: [invitedKeycloakId.payload.keycloakId],
		canInitiatorRefuse: true
	});
}

export async function handleCommandGuildInviteRefusePacketRes(packet: CommandGuildInviteRefusePacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const getInvitedPlayer = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.invitedPlayerKeycloakId);
	if (getInvitedPlayer.isError) {
		return;
	}
	const invitedUser = await crowniclesClient!.users.fetch(getInvitedPlayer!.payload.user.attributes.discordId![0]);


	if (buttonInteraction && originalInteraction) {
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildInvite.refusedTitle", {
					lng: originalInteraction.userLanguage,
					guildName: packet.guildName
				}), invitedUser)
					.setErrorColor()
			]
		});
	}
}

export async function handleCommandGuildInviteAcceptPacketRes(packet: CommandGuildInviteAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const getInvitedPlayer = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.invitedPlayerKeycloakId);
	if (getInvitedPlayer.isError) {
		return;
	}
	const invitedUser = await crowniclesClient!.users.fetch(getInvitedPlayer.payload.user.attributes.discordId![0]);

	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildInvite.successTitle", {
					lng,
					pseudo: escapeUsername(invitedUser.displayName),
					guildName: packet.guildName
				}), invitedUser)
					.setDescription(
						i18n.t("commands:guildInvite.successDesc", {
							lng,
							guildName: packet.guildName
						})
					)
			]
		});
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildInvite")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("guildInvite", "user", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
