import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildDomainPacketReq,
	CommandGuildDomainPacketRes,
	CommandGuildDomainUpgradeGuildLevelTooLowPacket,
	CommandGuildDomainUpgradeMaxLevelPacket,
	CommandGuildDomainUpgradeNotEnoughTreasuryPacket,
	CommandGuildDomainUpgradeSuccessPacket
} from "../../../../Lib/src/packets/commands/CommandGuildDomainPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import {
	sendErrorMessage, SendManner
} from "../../utils/ErrorUtils";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";

function getPacket(): CommandGuildDomainPacketReq {
	return makePacket(CommandGuildDomainPacketReq, {});
}

export async function handleDomainView(packet: CommandGuildDomainPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.setTitle(i18n.t("commands:guildDomain.title", {
			lng,
			guildName: packet.guildName
		}))
		.setDescription(i18n.t("commands:guildDomain.treasury", {
			lng,
			treasury: packet.treasury
		}));

	for (const building of packet.buildings) {
		const buildingKey = `commands:guildDomain.buildings.${building.building}`;
		let statusLine: string;
		if (building.level >= building.maxLevel) {
			statusLine = i18n.t("commands:guildDomain.maxLevel", { lng });
		}
		else if (building.upgradeCost !== null) {
			statusLine = i18n.t("commands:guildDomain.upgradeInfo", {
				lng,
				cost: building.upgradeCost,
				requiredLevel: building.requiredGuildLevel
			});
		}
		else {
			statusLine = "";
		}

		embed.addFields({
			name: i18n.t(`${buildingKey}.name`, { lng }),
			value: i18n.t(`${buildingKey}.description`, {
				lng,
				level: building.level,
				maxLevel: building.maxLevel
			}) + (statusLine ? `\n${statusLine}` : ""),
			inline: true
		});
	}

	await interaction.reply({ embeds: [embed] });
}

export async function handleUpgradeSuccess(packet: CommandGuildDomainUpgradeSuccessPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const buildingKey = `commands:guildDomain.buildings.${packet.building}`;
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:guildDomain.upgradeSuccessTitle", { lng }), interaction.user)
				.setDescription(i18n.t("commands:guildDomain.upgradeSuccess", {
					lng,
					buildingName: i18n.t(`${buildingKey}.name`, { lng }),
					newLevel: packet.newLevel,
					cost: packet.cost,
					remainingTreasury: packet.remainingTreasury
				}))
		]
	});
}

export async function handleUpgradeMaxLevel(packet: CommandGuildDomainUpgradeMaxLevelPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const buildingKey = `commands:guildDomain.buildings.${packet.building}`;
	await sendErrorMessage(interaction.user, context, interaction,
		i18n.t("commands:guildDomain.alreadyMaxLevel", {
			lng: interaction.userLanguage,
			buildingName: i18n.t(`${buildingKey}.name`, { lng: interaction.userLanguage })
		}),
		{ sendManner: SendManner.REPLY });
}

export async function handleNotEnoughTreasury(packet: CommandGuildDomainUpgradeNotEnoughTreasuryPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const buildingKey = `commands:guildDomain.buildings.${packet.building}`;
	await sendErrorMessage(interaction.user, context, interaction,
		i18n.t("commands:guildDomain.notEnoughTreasury", {
			lng: interaction.userLanguage,
			buildingName: i18n.t(`${buildingKey}.name`, { lng: interaction.userLanguage }),
			cost: packet.cost,
			treasury: packet.treasury
		}),
		{ sendManner: SendManner.REPLY });
}

export async function handleGuildLevelTooLow(packet: CommandGuildDomainUpgradeGuildLevelTooLowPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const buildingKey = `commands:guildDomain.buildings.${packet.building}`;
	await sendErrorMessage(interaction.user, context, interaction,
		i18n.t("commands:guildDomain.guildLevelTooLow", {
			lng: interaction.userLanguage,
			buildingName: i18n.t(`${buildingKey}.name`, { lng: interaction.userLanguage }),
			requiredLevel: packet.requiredGuildLevel,
			currentLevel: packet.currentGuildLevel
		}),
		{ sendManner: SendManner.REPLY });
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildDomain"),
	getPacket,
	mainGuildCommand: false
};
