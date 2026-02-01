import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DiscordCache } from "../../bot/DiscordCache";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import {
	CommandGuildKickAcceptPacketRes,
	CommandGuildKickPacketReq,
	CommandGuildKickPacketRes,
	CommandGuildKickRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildKickPacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorGuildKickPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildKick";
import { PacketUtils } from "../../utils/PacketUtils";
import {
	sendErrorMessage, SendManner
} from "../../utils/ErrorUtils";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../bot/CrowniclesShard";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";

/**
 * Kick a player from a guild
 */
async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<CommandGuildKickPacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, user);
	if (!askedPlayer) {
		return null;
	}
	return makePacket(CommandGuildKickPacketReq, { askedPlayer });
}

/**
 * Handle the response of the server after a guild kick,
 * this packet is only sent if the kick cannot be done for some reason
 * @param packet
 * @param context
 */
export async function handleCommandGuildKickPacketRes(packet: CommandGuildKickPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	if (!packet.foundPlayer) {
		await sendErrorMessage(
			interaction.user,
			context,
			interaction,
			i18n.t("commands:guildKick.noPlayer", { lng }),
			{ sendManner: SendManner.REPLY }
		);
		return;
	}
	if (!packet.sameGuild) {
		await sendErrorMessage(
			interaction.user,
			context,
			interaction,
			i18n.t("commands:guildKick.notSameGuild", { lng }),
			{ sendManner: SendManner.REPLY }
		);
		return;
	}
	if (packet.himself) {
		await sendErrorMessage(
			interaction.user,
			context,
			interaction,
			i18n.t("commands:guildKick.himself", { lng }),
			{ sendManner: SendManner.REPLY }
		);
	}
}

/**
 * Create a collector to confirm the guild kick
 * @param packet
 * @param context
 */
export async function createGuildKickCollector(context: PacketContext, packet: ReactionCollectorGuildKickPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data;
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildKick.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:guildKick.confirmDesc", {
				lng,
				kickedPseudo: await DisplayUtils.getEscapedUsername(data.kickedKeycloakId, lng),
				guildName: data.guildName
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

/**
 * Handle the response of the server after a guild kick,
 * this packet is only sent if the kick is refused
 * @param packet
 * @param context
 */
export async function handleCommandGuildKickRefusePacketRes(packet: CommandGuildKickRefusePacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = originalInteraction.userLanguage;
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildKick.canceledTitle", {
				lng,
				pseudo: escapeUsername(originalInteraction.user.displayName)
			}), originalInteraction.user)
				.setDescription(
					i18n.t("commands:guildKick.canceledDesc", {
						lng,
						kickedPseudo: await DisplayUtils.getEscapedUsername(packet.kickedKeycloakId, lng)
					})
				)
				.setErrorColor()
		]
	});
}

/**
 * Handle the response of the server after a guild kick,
 * this packet is only sent if the kick is accepted
 * @param packet
 * @param context
 */
export async function handleCommandGuildKickAcceptPacketRes(packet: CommandGuildKickAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const getKickedPlayer = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.kickedKeycloakId!);
	if (getKickedPlayer.isError) {
		return;
	}
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildKick.title", {
					lng,
					pseudo: escapeUsername(originalInteraction.user.displayName)
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:guildKick.acceptedDesc", {
							lng,
							kickedPseudo: escapeUsername(getKickedPlayer.payload.user.attributes.gameUsername[0]),
							guildName: packet.guildName
						})
					)
			]
		});
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildKick")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("guildKick", "user", option)
				.setRequired(false))
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("guildKick", "rank", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
