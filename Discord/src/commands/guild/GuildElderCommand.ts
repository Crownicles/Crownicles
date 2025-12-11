import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorGuildElderPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildElder";
import {
	CommandGuildElderAcceptPacketRes,
	CommandGuildElderPacketReq,
	CommandGuildElderRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildElderPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { PacketUtils } from "../../utils/PacketUtils";
import { SlashCommandBuilder } from "@discordjs/builders";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";

/**
 * Create a collector to confirm the promotion
 * @param packet
 * @param context
 */
export async function createGuildElderCollector(context: PacketContext, packet: ReactionCollectorGuildElderPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data;
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildElder.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:guildElder.confirmDesc", {
				lng,
				elderPseudo: await DisplayUtils.getEscapedUsername(data.promotedKeycloakId, lng),
				guildName: data.guildName
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

/**
 * Handle the response of the server after a guild elder,
 * this packet is only sent if the promotion is refused
 * @param packet
 * @param context
 */
export async function handleCommandGuildElderRefusePacketRes(packet: CommandGuildElderRefusePacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = originalInteraction.userLanguage;
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildElder.canceledTitle", {
				lng,
				pseudo: escapeUsername(originalInteraction.user.displayName)
			}), originalInteraction.user)
				.setDescription(
					i18n.t("commands:guildElder.canceledDesc", {
						lng,
						elderPseudo: await DisplayUtils.getEscapedUsername(packet.promotedKeycloakId, lng)
					})
				)
				.setErrorColor()
		]
	});
}


/**
 * Handle the response of the server after a guild elder,
 * this packet is only sent if the promotion is accepted
 * @param packet
 * @param context
 */
export async function handleCommandGuildElderAcceptPacketRes(packet: CommandGuildElderAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildElder.successElderAddTitle", {
					lng,
					elderPseudo: await DisplayUtils.getEscapedUsername(packet.promotedKeycloakId!, lng),
					guildName: packet.guildName
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:guildElder.acceptedDesc", { lng })
					)
			]
		});
	}
}

/**
 * Promote a player from a guild
 */
async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<CommandGuildElderPacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, user);
	if (!askedPlayer || !askedPlayer.keycloakId) {
		return null;
	}
	return makePacket(CommandGuildElderPacketReq, { askedPlayerKeycloakId: askedPlayer.keycloakId });
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildElder")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("guildElder", "user", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
