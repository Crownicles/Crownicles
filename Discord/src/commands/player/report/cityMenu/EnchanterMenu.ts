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
import { Language } from "../../../../../../Lib/src/Language";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
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
import {
	CityCollectorHandlerParams, CityMenuParams
} from "../ReportCityMenuTypes";

type EnchanterHandlerParams = CityCollectorHandlerParams & { data: EnchanterCityData };

type EnchanterCollectorParams = Omit<CityMenuParams, "pseudo"> & { data: EnchanterCityData };

async function handleEnchantItemSelection(
	selectedValue: string,
	buttonInteraction: MessageComponentInteraction,
	context: PacketContext,
	packet: ReactionCollectorCreationPacket,
	data: EnchanterCityData
): Promise<void> {
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

async function handleEnchanterCollectorInteraction(params: EnchanterHandlerParams): Promise<void> {
	const {
		selectedValue, buttonInteraction, nestedMenus, context, packet, data
	} = params;

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

	if (selectedValue.startsWith(ReportCityMenuIds.ENCHANT_ITEM_PREFIX)) {
		await handleEnchantItemSelection(selectedValue, buttonInteraction, context, packet, data);
	}
}

function createEnchanterMenuCollector(
	params: EnchanterCollectorParams
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const {
		context, interaction, packet, data, collectorTime
	} = params;
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleEnchanterCollectorInteraction({
			selectedValue: customId, buttonInteraction, nestedMenus, context, packet, data
		});
	});
}

function addEnchanterTitle(container: ContainerBuilder, lng: Language, pseudo: string): void {
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.enchanter.title", {
				lng, pseudo
			})}`
		)
	);
}

function buildEnchanterStory(data: EnchanterCityData, lng: Language): string {
	let desc = `${i18n.t("commands:report.city.enchanter.story", { lng })}\n\n`;
	const price = data.enchantmentCost.gems === 0
		? i18n.t("commands:report.city.enchanter.priceMoneyOnly", {
			lng, money: data.enchantmentCost.money
		})
		: i18n.t("commands:report.city.enchanter.priceMoneyAndGems", {
			lng, money: data.enchantmentCost.money, gems: data.enchantmentCost.gems
		});
	const enchantmentKey = data.mageReduction
		? "commands:report.city.enchanter.enchantmentWithReduction"
		: "commands:report.city.enchanter.enchantmentNoReduction";
	desc += i18n.t(enchantmentKey, {
		lng,
		price,
		enchantmentId: data.enchantmentId,
		enchantmentType: data.enchantmentType
	});
	if (data.hasAtLeastOneEnchantedItem) {
		desc += `\n\n${i18n.t("commands:report.city.enchanter.hasAtLeastOneEnchantedItem", { lng })}`;
	}
	return desc;
}

function addEnchantableItemsSection(container: ContainerBuilder, data: EnchanterCityData, lng: Language): void {
	if (data.enchantableItems.length === 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				i18n.t("commands:report.city.enchanter.emptyInventoryStory", { lng })
			)
		);
		return;
	}

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(buildEnchanterStory(data, lng))
	);

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

function addEnchanterNavigation(container: ContainerBuilder, lng: Language): void {
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
}

export function getEnchanterMenu(params: CityMenuParams): CrowniclesNestedMenu {
	const data = (params.packet.data.data as ReactionCollectorCityData).enchanter!;
	const lng = params.interaction.userLanguage;

	const container = new ContainerBuilder();
	addEnchanterTitle(container, lng, params.pseudo);
	addEnchantableItemsSection(container, data, lng);
	addEnchanterNavigation(container, lng);

	return {
		containers: [container],
		createCollector: createEnchanterMenuCollector({
			context: params.context,
			interaction: params.interaction,
			packet: params.packet,
			data,
			collectorTime: params.collectorTime
		})
	};
}
