import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportItemEnchantedRes,
	CommandReportUpgradeItemRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { MessagesUtils } from "../../../../utils/MessagesUtils";

export async function handleItemEnchanted(packet: CommandReportItemEnchantedRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.enchanter.acceptTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.enchanter.acceptStory", {
			lng,
			enchantmentId: packet.enchantmentId,
			enchantmentType: packet.enchantmentType
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleUpgradeItem(packet: CommandReportUpgradeItemRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.homes.upgradeItemTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.homes.upgradeItemDescription", {
			lng,
			newLevel: packet.newItemLevel
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleUpgradeItemMissingMaterials(context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.homes.upgradeItemMissingMaterialsTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.homes.upgradeItemMissingMaterialsDescription", { lng }));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleUpgradeItemMaxLevel(context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.homes.upgradeItemMaxLevelTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.homes.upgradeItemMaxLevelDescription", { lng }));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleBlacksmithUpgrade(
	packet: {
		newItemLevel: number; totalCost: number; boughtMaterials: boolean;
	},
	context: PacketContext
): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;
	const descriptionKey = packet.boughtMaterials
		? "commands:report.city.blacksmith.upgradeSuccessWithBuy"
		: "commands:report.city.blacksmith.upgradeSuccess";

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.blacksmith.upgradeTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t(descriptionKey, {
			lng,
			newLevel: packet.newItemLevel
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleBlacksmithDisenchant(
	_packet: { cost: number },
	context: PacketContext
): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.blacksmith.disenchantTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.blacksmith.disenchantSuccess", { lng }));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleBlacksmithNotEnoughMoney(
	packet: { missingMoney: number },
	context: PacketContext
): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.blacksmith.title", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.blacksmith.notEnoughMoney", {
			lng,
			missingMoney: packet.missingMoney
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleBlacksmithMissingMaterials(context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.blacksmith.missingMaterialsTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.blacksmith.missingMaterialsDescription", { lng }));

	await interaction.editReply({
		embeds: [embed]
	});
}
