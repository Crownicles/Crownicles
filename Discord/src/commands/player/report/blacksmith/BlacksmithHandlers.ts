import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportItemEnchantedRes,
	CommandReportUpgradeItemRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { MessagesUtils } from "../../../../utils/MessagesUtils";

type BlacksmithReplyConfig = {
	context: PacketContext;
	titleKey: string;
	descriptionKey: string;
	descriptionParams?: Record<string, unknown>;
};

async function sendBlacksmithReply(config: BlacksmithReplyConfig): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(config.context);
	if (!interaction) {
		return;
	}
	const lng = config.context.discord!.language;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t(config.titleKey, {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(config.context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t(config.descriptionKey, {
			lng, ...config.descriptionParams
		}));
	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleItemEnchanted(packet: CommandReportItemEnchantedRes, context: PacketContext): Promise<void> {
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.enchanter.acceptTitle",
		descriptionKey: "commands:report.city.enchanter.acceptStory",
		descriptionParams: {
			enchantmentId: packet.enchantmentId,
			enchantmentType: packet.enchantmentType
		}
	});
}

export async function handleUpgradeItem(packet: CommandReportUpgradeItemRes, context: PacketContext): Promise<void> {
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.homes.upgradeItemTitle",
		descriptionKey: "commands:report.city.homes.upgradeItemDescription",
		descriptionParams: { newLevel: packet.newItemLevel }
	});
}

export async function handleUpgradeItemMissingMaterials(context: PacketContext): Promise<void> {
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.homes.upgradeItemMissingMaterialsTitle",
		descriptionKey: "commands:report.city.homes.upgradeItemMissingMaterialsDescription"
	});
}

export async function handleUpgradeItemMaxLevel(context: PacketContext): Promise<void> {
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.homes.upgradeItemMaxLevelTitle",
		descriptionKey: "commands:report.city.homes.upgradeItemMaxLevelDescription"
	});
}

export async function handleBlacksmithUpgrade(
	packet: {
		newItemLevel: number; totalCost: number; boughtMaterials: boolean;
	},
	context: PacketContext
): Promise<void> {
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.blacksmith.upgradeTitle",
		descriptionKey: packet.boughtMaterials
			? "commands:report.city.blacksmith.upgradeSuccessWithBuy"
			: "commands:report.city.blacksmith.upgradeSuccess",
		descriptionParams: { newLevel: packet.newItemLevel }
	});
}

export async function handleBlacksmithDisenchant(
	_packet: { cost: number },
	context: PacketContext
): Promise<void> {
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.blacksmith.disenchantTitle",
		descriptionKey: "commands:report.city.blacksmith.disenchantSuccess"
	});
}

export async function handleBlacksmithNotEnoughMoney(
	packet: { missingMoney: number },
	context: PacketContext
): Promise<void> {
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.blacksmith.title",
		descriptionKey: "commands:report.city.blacksmith.notEnoughMoney",
		descriptionParams: { missingMoney: packet.missingMoney }
	});
}

export async function handleBlacksmithMissingMaterials(context: PacketContext): Promise<void> {
	await sendBlacksmithReply({
		context,
		titleKey: "commands:report.city.blacksmith.missingMaterialsTitle",
		descriptionKey: "commands:report.city.blacksmith.missingMaterialsDescription"
	});
}
