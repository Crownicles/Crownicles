import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import {
	CommandGuildCreateAcceptPacketRes,
	CommandGuildCreatePacketReq,
	CommandGuildCreatePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildCreatePacket";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorGuildCreatePacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import { GuildCreateConstants } from "../../../../Lib/src/constants/GuildCreateConstants";
import { LANGUAGE } from "../../../../Lib/src/Language";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Create a new guild
 */
function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): CommandGuildCreatePacketReq {
	const askedGuildName = <string>interaction.options.get("name", true).value;
	return makePacket(CommandGuildCreatePacketReq, {
		keycloakId: user.id,
		askedGuildName
	});
}

async function replyErrorEmbed(context: PacketContext, errorKey: string, formatParams: Record<string, unknown> = {}): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const replacements = {
		lng: interaction?.userLanguage ?? LANGUAGE.ENGLISH,
		...formatParams
	};
	const params = {
		embeds: [
			new CrowniclesErrorEmbed(
				interaction!.user,
				context,
				interaction!,
				i18n.t(errorKey, replacements)
			)
		]
	};
	if (interaction && buttonInteraction) {
		await buttonInteraction.editReply(params);
	}
	else if (interaction) {
		await interaction.reply(params);
	}
}


export async function handleCommandGuildCreatePacketRes(packet: CommandGuildCreatePacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (interaction) {
		if (packet.foundGuild) {
			await replyErrorEmbed(context, "error:alreadyInAGuild");
			return;
		}
		if (!packet.guildNameIsAvailable) {
			await replyErrorEmbed(context, "error:guildAlreadyExist");
			return;
		}
		if (!packet.guildNameIsAcceptable) {
			await replyErrorEmbed(context, "error:guildNameNotValid", {
				min: GuildConstants.GUILD_NAME_LENGTH_RANGE.MIN,
				max: GuildConstants.GUILD_NAME_LENGTH_RANGE.MAX
			});
			return;
		}
		if (packet.playerMoney < GuildCreateConstants.PRICE) {
			await replyErrorEmbed(context, "error:notEnoughMoney", {
				money: GuildCreateConstants.PRICE - packet.playerMoney
			});
		}
	}
}


export async function createGuildCreateCollector(context: PacketContext, packet: ReactionCollectorGuildCreatePacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data;
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildCreate.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:guildCreate.confirmDesc", {
				lng,
				guildName: data.guildName,
				price: GuildCreateConstants.PRICE
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

export async function handleCommandGuildCreateRefusePacketRes(context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildCreate.canceledTitle", {
					lng,
					pseudo: escapeUsername(originalInteraction.user.displayName)
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:guildCreate.canceledDesc", { lng })
					)
					.setErrorColor()
			]
		});
	}
}

export async function handleCommandGuildCreateAcceptPacketRes(packet: CommandGuildCreateAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildCreate.title", {
					lng,
					pseudo: escapeUsername(originalInteraction.user.displayName)
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:guildCreate.acceptedDesc", {
							lng,
							guildName: packet.guildName
						})
					)
					.setFooter({
						text:
							i18n.t("commands:guildCreate.acceptedFooter", { lng })
					})
			]
		});
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildCreate")
		.addStringOption(option =>
			SlashCommandBuilderGenerator.generateOption("guildCreate", "guildName", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
