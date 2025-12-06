import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandPetFreeAcceptPacketRes,
	CommandPetFreePacketReq,
	CommandPetFreePacketRes
} from "../../../../Lib/src/packets/commands/CommandPetFreePacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { printTimeBeforeDate } from "../../../../Lib/src/utils/TimeUtils";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { ReactionCollectorPetFreeData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFree";
import { PetUtils } from "../../utils/PetUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Destroy a pet forever... RIP
 */
function getPacket(_interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): CommandPetFreePacketReq {
	return makePacket(CommandPetFreePacketReq, { keycloakId: keycloakUser.id });
}


export async function handleCommandPetFreePacketRes(packet: CommandPetFreePacketRes, context: PacketContext): Promise<void> {
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
	if (packet.petCanBeFreed) {
		return;
	}
	if (packet.missingMoney! > 0) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:notEnoughMoney", {
						lng,
						money: packet.missingMoney
					})
				)
			]
		});
	}
	if (packet.cooldownRemainingTimeMs! > 0) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:cooldownPetFree", {
						lng,
						remainingTime: printTimeBeforeDate(packet.cooldownRemainingTimeMs! + new Date().valueOf())
					})
				)
			]
		});
		return;
	}
	if (packet.petOnExpedition) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:petFree.petOnExpedition", { lng })
				)
			]
		});
	}
}

export async function createPetFreeCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data as ReactionCollectorPetFreeData;
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:petFree.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:petFree.confirmDesc", {
				lng,
				pet: PetUtils.petToShortString(lng, data.petNickname, data.petId, data.petSex)
			})
		);

	if (data.freeCost) {
		embed.setFooter({
			text: i18n.t("commands:petFree.isFeisty", {
				lng,
				cost: data.freeCost
			})
		});
	}

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

export async function handleCommandPetFreeRefusePacketRes(context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:petFree.canceledTitle", {
					lng,
					pseudo: escapeUsername(originalInteraction.user.displayName)
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:petFree.canceledDesc", { lng })
					)
					.setErrorColor()
			]
		});
	}
}

export async function handleCommandPetFreeAcceptPacketRes(packet: CommandPetFreeAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:petFree.title", {
					lng,
					pseudo: escapeUsername(originalInteraction.user.displayName)
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:petFree.acceptedDesc", {
							lng,
							pet: PetUtils.petToShortString(lng, packet.petNickname, packet.petId, packet.petSex)
						})
					)
			]
		});
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("petFree"),
	getPacket,
	mainGuildCommand: false
};
