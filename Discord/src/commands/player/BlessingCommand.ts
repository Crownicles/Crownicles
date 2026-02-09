import { ICommand } from "../ICommand";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandBlessingPacketReq } from "../../../../Lib/src/packets/commands/CommandBlessingPacketReq";
import { CommandBlessingPacketRes } from "../../../../Lib/src/packets/commands/CommandBlessingPacketRes";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { resolveKeycloakPlayerName } from "../../utils/StringUtils";
import { BlessingType } from "../../../../Lib/src/constants/BlessingConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { printTimeBeforeDate } from "../../../../Lib/src/utils/TimeUtils";
import {
	escapeUsername, progressBar
} from "../../../../Lib/src/utils/StringUtils";
import { Language } from "../../../../Lib/src/Language";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandBlessingPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandBlessingPacketReq, {});
}

/**
 * Build the top contributor line for the collecting state, or empty string if no contributors
 */
async function buildTopContributorLine(packet: CommandBlessingPacketRes, lng: Language): Promise<string> {
	if (!packet.topContributorKeycloakId || packet.totalContributors <= 0) {
		return "";
	}
	const topContributorName = await resolveKeycloakPlayerName(packet.topContributorKeycloakId, lng);
	return `\n\n${i18n.t("commands:blessing.contributors", {
		lng,
		topContributorName,
		topContributorAmount: packet.topContributorAmount,
		totalContributors: packet.totalContributors,
		moneyEmote: CrowniclesIcons.unitValues.money
	})}`;
}

/**
 * Handle the response of the blessing command
 */
export async function handleCommandBlessingPacketRes(context: PacketContext, packet: CommandBlessingPacketRes): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const hasBlessing = packet.activeBlessingType !== BlessingType.NONE;

	let description: string;

	if (hasBlessing) {
		const triggeredByName = await resolveKeycloakPlayerName(packet.lastTriggeredByKeycloakId, lng);

		description = i18n.t("commands:blessing.active", {
			lng,
			blessingName: i18n.t(`bot:blessingNames.${packet.activeBlessingType}`, { lng }),
			blessingEffect: i18n.t(`bot:blessingEffects.${packet.activeBlessingType}`, { lng }),
			timeLeft: printTimeBeforeDate(packet.blessingEndAt),
			triggeredBy: triggeredByName,
			moneyEmote: CrowniclesIcons.unitValues.money
		});
	}
	else {
		const topContributorLine = await buildTopContributorLine(packet, lng);

		description = `${i18n.t("commands:blessing.collecting", {
			lng,
			poolAmount: packet.poolAmount,
			poolThreshold: packet.poolThreshold,
			moneyEmote: CrowniclesIcons.unitValues.money,
			percentage: Math.floor(packet.poolAmount / packet.poolThreshold * 100)
		})}\n${progressBar(packet.poolAmount, packet.poolThreshold)}${topContributorLine}`;
	}

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:blessing.title", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(description);

	await interaction.editReply({ embeds: [embed] });
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("blessing"),
	getPacket,
	mainGuildCommand: false
};
