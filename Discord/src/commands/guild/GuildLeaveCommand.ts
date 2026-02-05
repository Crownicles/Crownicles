import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandGuildLeaveAcceptPacketRes,
	CommandGuildLeavePacketReq
} from "../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorGuildLeavePacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../bot/CrowniclesShard";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";

/**
 * Create a collector to accept/refuse to leave the guild
 * @param packet
 * @param context
 */
export async function createGuildLeaveCollector(context: PacketContext, packet: ReactionCollectorGuildLeavePacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data;
	const keyDesc = data.isGuildDestroyed ? "confirmChiefDesc" : data.newChiefKeycloakId ? "confirmChiefDescWithElder" : "confirmDesc";
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildLeave.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t(`commands:guildLeave.${keyDesc}`, {
				lng,
				newChiefPseudo: await DisplayUtils.getEscapedUsername(data.newChiefKeycloakId, lng),
				guildName: data.guildName
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

/**
 * Handle the response when the player leaves its guild
 * @param packet
 * @param context
 */
export async function handleCommandGuildLeaveAcceptPacketRes(packet: CommandGuildLeaveAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const keyDesc = packet.isGuildDestroyed ? "destroySuccess" : packet.newChiefKeycloakId ? "leavingSuccessWithNewChief" : "leavingSuccess";
	const getChief = packet.newChiefKeycloakId ? await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.newChiefKeycloakId) : undefined;
	if (getChief?.isError || (getChief && !getChief.payload.user)) {
		return;
	}
	const newChiefPseudo = getChief?.payload.user ? escapeUsername(getChief.payload.user.attributes.gameUsername[0]) : "";
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildLeave.successTitle", {
					lng,
					pseudo: escapeUsername(originalInteraction.user.displayName),
					guildName: packet.guildName
				}), originalInteraction.user)
					.setDescription(
						i18n.t(`commands:guildLeave.${keyDesc}`, {
							lng,
							newChiefPseudo,
							guildName: packet.guildName
						})
					)
			]
		});
	}
}

/**
 * Handle the response when the player doesn't leave its guild
 * @param context
 */
export async function handleCommandGuildLeaveRefusePacketRes(context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = originalInteraction.userLanguage;
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildLeave.canceledTitle", {
				lng,
				pseudo: escapeUsername(originalInteraction.user.displayName)
			}), originalInteraction.user)
				.setDescription(
					i18n.t("commands:guildLeave.canceledDesc", {
						lng
					})
				)
				.setErrorColor()
		]
	});
}

/**
 * Allow the player to leave its guild
 */
function getPacket(): CommandGuildLeavePacketReq {
	return makePacket(CommandGuildLeavePacketReq, {});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildLeave"),
	getPacket,
	mainGuildCommand: false
};
