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
	CommandUnlockAcceptPacketRes,
	CommandUnlockNotEnoughMoney,
	CommandUnlockPacketReq
} from "../../../../Lib/src/packets/commands/CommandUnlockPacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorUnlockPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorUnlock";
import { PacketUtils } from "../../utils/PacketUtils";
import { CommandProfilePacketReq } from "../../../../Lib/src/packets/commands/CommandProfilePacket";
import {
	sendErrorMessage, SendManner
} from "../../utils/ErrorUtils";
import { UnlockConstants } from "../../../../Lib/src/constants/UnlockConstants";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";

/**
 * Free a player from the prison
 */
async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<CommandProfilePacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, user);
	if (!askedPlayer) {
		return null;
	}
	return makePacket(CommandUnlockPacketReq, { askedPlayer });
}

/**
 *
 * @param packet
 * @param context
 */
export async function handleCommandUnlockNotEnoughMoneyError(packet: CommandUnlockNotEnoughMoney, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	await sendErrorMessage(
		interaction.user,
		context,
		interaction,
		i18n.t("error:notEnoughMoney", {
			lng: interaction.userLanguage,
			money: UnlockConstants.PRICE_FOR_UNLOCK - packet.money
		}),
		{ sendManner: SendManner.REPLY }
	);
}

/**
 * Create a collector to confirm the unlocking
 * @param packet
 * @param context
 */
export async function createUnlockCollector(context: PacketContext, packet: ReactionCollectorUnlockPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const lng = interaction.userLanguage;
	const data = packet.data.data;
	const pseudo = await DisplayUtils.getEscapedUsername(data.unlockedKeycloakId, lng);
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:unlock.title", {
		lng,
		pseudo
	}), interaction.user)
		.setDescription(
			i18n.t("commands:unlock.confirmDesc", {
				lng,
				pseudo,
				price: UnlockConstants.PRICE_FOR_UNLOCK
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

/**
 * Handle the server response after an unlock command has been canceled
 * @param context
 */
export async function handleCommandUnlockRefusePacketRes(context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const lng = originalInteraction.userLanguage;
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed().formatAuthor(i18n.t("commands:unlock.canceledTitle", {
				lng,
				pseudo: escapeUsername(originalInteraction.user.displayName)
			}), originalInteraction.user)
				.setDescription(
					i18n.t("commands:unlock.canceledDesc", { lng })
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
export async function handleCommandUnlockAcceptPacketRes(packet: CommandUnlockAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const lng = originalInteraction.userLanguage;
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed().formatAuthor(i18n.t("commands:unlock.title", {
				lng,
				pseudo: await DisplayUtils.getEscapedUsername(packet.unlockedKeycloakId, lng)
			}), originalInteraction.user)
				.setDescription(
					i18n.t("commands:unlock.acceptedDesc", {
						lng,
						pseudo: await DisplayUtils.getEscapedUsername(packet.unlockedKeycloakId, lng)
					})
				)
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("unlock")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("unlock", "user", option)
				.setRequired(false))
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("unlock", "rank", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
