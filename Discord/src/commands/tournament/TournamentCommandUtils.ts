import {
	ChannelType, MessageFlags, PermissionsBitField
} from "discord.js";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import {
	PacketContext, CrowniclesPacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { PacketUtils } from "../../utils/PacketUtils";
import {
	discordConfig, crowniclesClient
} from "../../bot/CrowniclesShard";

export function isBotOwner(interaction: CrowniclesInteraction): boolean {
	return interaction.user.id === discordConfig.OWNER_ID;
}

export function isGuildAdministrator(interaction: CrowniclesInteraction): boolean {
	return interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator) ?? false;
}

export function hasTournamentChannelPermissions(interaction: CrowniclesInteraction): boolean {
	const permissions = interaction.channel.permissionsFor(crowniclesClient!.user!);
	if (!permissions) {
		return false;
	}
	return [
		PermissionsBitField.Flags.ViewChannel,
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.SendMessagesInThreads,
		PermissionsBitField.Flags.AddReactions,
		PermissionsBitField.Flags.EmbedLinks,
		PermissionsBitField.Flags.AttachFiles,
		PermissionsBitField.Flags.ReadMessageHistory
	].every(permission => permissions.has(permission));
}

export function isTournamentParentChannel(interaction: CrowniclesInteraction): boolean {
	return ![
		ChannelType.PublicThread,
		ChannelType.PrivateThread,
		ChannelType.AnnouncementThread
	].includes(interaction.channel.type);
}

export function hasMinimumGuildSize(interaction: CrowniclesInteraction): boolean {
	return (interaction.guild?.memberCount ?? 0) >= TournamentConstants.MINIMUM_SERVER_MEMBER_COUNT;
}

export async function replyTournamentError(interaction: CrowniclesInteraction, key: string): Promise<null> {
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.setErrorColor()
				.setTitle(i18n.t("commands:tournament.errorTitle", { lng: interaction.userLanguage }))
				.setDescription(i18n.t(`commands:tournament.errors.${key}`, { lng: interaction.userLanguage }))
		],
		flags: MessageFlags.Ephemeral
	});
	return null;
}

export async function createTournamentContext(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<PacketContext> {
	return await PacketUtils.createPacketContext(interaction, user);
}

export function sendTournamentPacket(context: PacketContext, packet: CrowniclesPacket): void {
	PacketUtils.sendPacketToBackend(context, packet);
}
