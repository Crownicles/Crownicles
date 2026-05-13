import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	MessageComponentInteraction, SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	EnchanterCityData,
	ReactionCollectorCityData,
	ReactionCollectorEnchantReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import i18n from "../../../../translations/i18n";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import {
	addCitySection,
	createCityCollector,
	createStayInCityButton,
	handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";

async function handleEnchanterCollectorInteraction(
	selectedValue: string,
	buttonInteraction: MessageComponentInteraction,
	nestedMenus: CrowniclesNestedMenus,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket,
	data: EnchanterCityData
): Promise<void> {
	if (selectedValue === ReportCityMenuIds.BACK_TO_CITY) {
		await buttonInteraction.deferUpdate();
		await nestedMenus.changeToMainMenu();
		return;
	}

	if (selectedValue === ReportCityMenuIds.STAY_IN_CITY) {
		await buttonInteraction.deferUpdate();
		handleStayInCityInteraction(packet, context, buttonInteraction);
		return;
	}

	if (!selectedValue.startsWith(ReportCityMenuIds.ENCHANT_ITEM_PREFIX)) {
		return;
	}

	await buttonInteraction.deferReply();
	const index = parseInt(selectedValue.replace(ReportCityMenuIds.ENCHANT_ITEM_PREFIX, ""), 10);
	if (index < 0 || index >= data.enchantableItems.length) {
		return;
	}

	const slot = data.enchantableItems[index].slot;
	const itemCategory = data.enchantableItems[index].category;
	const reactionIndex = packet.reactions.findIndex(
		reaction => reaction.type === ReactionCollectorEnchantReaction.name
			&& (reaction.data as ReactionCollectorEnchantReaction).slot === slot
			&& (reaction.data as ReactionCollectorEnchantReaction).itemCategory === itemCategory
	);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
	}
}

function createEnchanterMenuCollector(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	data: EnchanterCityData,
	collectorTime: number
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleEnchanterCollectorInteraction(customId, buttonInteraction, nestedMenus, context, packet, data);
	});
}

export function getEnchanterMenu(context: PacketContext, interaction: CrowniclesInteraction, packet: ReactionCollectorCreationPacket, collectorTime: number, pseudo: string): CrowniclesNestedMenu {
	const data = (packet.data.data as ReactionCollectorCityData).enchanter!;
	const lng = interaction.userLanguage;

	const container = new ContainerBuilder();

	// Title
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.enchanter.title", {
				lng, pseudo
			})}`
		)
	);

	// Story
	if (data.enchantableItems.length === 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.enchanter.emptyInventoryStory", { lng })
			)
		);
	}
	else {
		let desc = `${i18n.t("commands:report.city.enchanter.story", { lng })}\n\n`;
		const price = data.enchantmentCost.gems === 0
			? i18n.t("commands:report.city.enchanter.priceMoneyOnly", {
				lng, money: data.enchantmentCost.money
			})
			: i18n.t("commands:report.city.enchanter.priceMoneyAndGems", {
				lng, money: data.enchantmentCost.money, gems: data.enchantmentCost.gems
			});
		if (data.mageReduction) {
			desc += i18n.t("commands:report.city.enchanter.enchantmentWithReduction", {
				lng,
				price,
				enchantmentId: data.enchantmentId,
				enchantmentType: data.enchantmentType
			});
		}
		else {
			desc += i18n.t("commands:report.city.enchanter.enchantmentNoReduction", {
				lng,
				price,
				enchantmentId: data.enchantmentId,
				enchantmentType: data.enchantmentType
			});
		}
		if (data.hasAtLeastOneEnchantedItem) {
			desc += `\n\n${i18n.t("commands:report.city.enchanter.hasAtLeastOneEnchantedItem", { lng })}`;
		}
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(desc)
		);

		// Enchantable items
		for (let i = 0; i < data.enchantableItems.length; i++) {
			const item = data.enchantableItems[i];
			const itemDisplay = DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng);

			container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
			addCitySection({
				container,
				text: itemDisplay,
				customId: `${ReportCityMenuIds.ENCHANT_ITEM_PREFIX}${i}`,
				buttonLabel: i18n.t("commands:report.city.buttons.enchant", { lng })
			});
		}
	}

	// Back to city + Stay in city buttons
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ReportCityMenuIds.BACK_TO_CITY)
				.setLabel(i18n.t("commands:report.city.enchanter.leave", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ButtonStyle.Secondary),
			createStayInCityButton(lng)
		)
	);

	return {
		containers: [container],
		createCollector: createEnchanterMenuCollector(context, interaction, packet, data, collectorTime)
	};
}
