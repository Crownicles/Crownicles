import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	EnchanterCityData,
	ReactionCollectorCityData,
	ReactionCollectorEnchantReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { ItemCategory } from "../../../../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../../../../Lib/src/types/ItemEnchantment";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { StringUtils } from "../../../../utils/StringUtils";
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
import { openCityConfirmation } from "../confirmation/CityConfirmationMenu";

const ENCHANTMENT_DESCRIPTION_NOT_FOUND = "ERR_ENCHANTMENT_DESCRIPTION_NOT_FOUND";

type EnchanterHandlerParams = CityCollectorHandlerParams & Pick<CityMenuParams, "collectorTime" | "interaction" | "pseudo"> & { data: EnchanterCityData };

type EnchanterCollectorParams = CityMenuParams & { data: EnchanterCityData };

function parseEnchantItemIndex(selectedValue: string, data: EnchanterCityData): number | null {
	const index = parseInt(selectedValue.replace(ReportCityMenuIds.ENCHANT_ITEM_PREFIX, ""), 10);
	return index >= 0 && index < data.enchantableItems.length ? index : null;
}

function buildEnchantmentPrice(data: EnchanterCityData, lng: Language): string {
	return data.enchantmentCost.gems === 0
		? i18n.t("commands:report.city.enchanter.priceMoneyOnly", {
			lng, money: data.enchantmentCost.money
		})
		: i18n.t("commands:report.city.enchanter.priceMoneyAndGems", {
			lng, money: data.enchantmentCost.money, gems: data.enchantmentCost.gems
		});
}

function buildEnchantmentBalance(data: EnchanterCityData, lng: Language): string {
	return data.enchantmentCost.gems === 0
		? i18n.t("commands:report.city.enchanter.balanceMoneyOnly", {
			lng, money: data.playerMoney
		})
		: i18n.t("commands:report.city.enchanter.balanceMoneyAndGems", {
			lng, money: data.playerMoney, gems: data.playerGems
		});
}

function sendEnchantReaction(params: EnchanterHandlerParams, index: number): void {
	const {
		selectedValue, buttonInteraction, context, packet, data
	} = params;
	const item = data.enchantableItems[index];
	if (!item || !selectedValue.startsWith(ReportCityMenuIds.ENCHANT_ITEM_PREFIX)) {
		return;
	}

	const reactionIndex = packet.reactions.findIndex(
		reaction => reaction.type === ReactionCollectorEnchantReaction.name
			&& (reaction.data as ReactionCollectorEnchantReaction).slot === item.slot
			&& (reaction.data as ReactionCollectorEnchantReaction).itemCategory === item.category
	);
	if (reactionIndex !== -1) {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
	}
}

async function handleEnchantItemSelection(params: EnchanterHandlerParams): Promise<void> {
	const index = parseEnchantItemIndex(params.selectedValue, params.data);
	if (index === null) {
		await params.buttonInteraction.deferUpdate();
		return;
	}
	const item = params.data.enchantableItems[index];
	const lng = params.interaction.userLanguage;
	await params.buttonInteraction.deferUpdate();
	await openCityConfirmation(params.nestedMenus, {
		interaction: params.interaction,
		collectorTime: params.collectorTime,
		lng,
		pseudo: params.pseudo
	}, {
		description: i18n.t("commands:report.city.enchanter.confirmDescription", {
			lng,
			item: DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng),
			price: buildEnchantmentPrice(params.data, lng),
			balance: buildEnchantmentBalance(params.data, lng),
			enchantmentId: params.data.enchantmentId,
			enchantmentType: params.data.enchantmentType
		}),
		confirmLabel: i18n.t("commands:report.city.buttons.enchant", { lng }),
		confirmEmoji: CrowniclesIcons.city.services.enchanter,
		backMenuId: ReportCityMenuIds.ENCHANTER_MENU,
		confirmAck: "reply",
		onConfirm: async action => {
			await sendEnchantReaction({
				...params,
				buttonInteraction: action.buttonInteraction,
				nestedMenus: action.nestedMenus
			}, index);
		}
	});
}

async function handleEnchanterCollectorInteraction(params: EnchanterHandlerParams): Promise<void> {
	const {
		selectedValue, buttonInteraction, nestedMenus, context, packet
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
		await handleEnchantItemSelection(params);
	}
}

function createEnchanterMenuCollector(
	params: EnchanterCollectorParams
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	const {
		context, interaction, packet, data, collectorTime, pseudo
	} = params;
	return createCityCollector(interaction, collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		await handleEnchanterCollectorInteraction({
			selectedValue: customId, buttonInteraction, nestedMenus, context, packet, data, interaction, collectorTime, pseudo
		});
	});
}

function addEnchanterTitle(container: ContainerBuilder, lng: Language, pseudo: string): void {
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			StringUtils.formatHeader(i18n.t("commands:report.city.enchanter.title", {
				lng, pseudo
			}))
		)
	);
}

export function buildEnchantmentDescription(data: EnchanterCityData, lng: Language): string {
	const enchantment = ItemEnchantment.getById(data.enchantmentId);
	if (!enchantment) {
		throw new Error(`Unknown enchantment '${data.enchantmentId}' in enchanter city data`);
	}
	const key = `commands:report.city.enchanter.descriptions.${enchantment.kind.id}`;
	return i18n.t(key, {
		lng,
		fallbackLng: false,
		defaultValue: ENCHANTMENT_DESCRIPTION_NOT_FOUND
	});
}

function buildEnchanterStory(data: EnchanterCityData, lng: Language): string {
	const enchantmentKey = data.mageReduction
		? "commands:report.city.enchanter.enchantmentWithReduction"
		: "commands:report.city.enchanter.enchantmentNoReduction";
	return StringUtils.joinParagraphs([
		i18n.t("commands:report.city.enchanter.story", { lng }),
		i18n.t(enchantmentKey, {
			lng,
			price: buildEnchantmentPrice(data, lng),
			enchantmentId: data.enchantmentId,
			enchantmentType: data.enchantmentType
		}),
		buildEnchantmentDescription(data, lng),
		buildEnchantmentBalance(data, lng),
		data.hasAtLeastOneEnchantedItem
			&& i18n.t("commands:report.city.enchanter.hasAtLeastOneEnchantedItem", { lng })
	]);
}

function buildNoEnchantableItemStory(data: EnchanterCityData, lng: Language): string {
	let story: string;
	if (data.isInventoryEmpty) {
		story = i18n.t("commands:report.city.enchanter.emptyInventoryStory", { lng });
	}
	else if (data.unenchantedItemsInOtherSlotCount > 0) {
		const key = data.enchantmentSlot === ItemCategory.WEAPON
			? "commands:report.city.enchanter.runeForWeaponOnlyArmorAvailableStory"
			: "commands:report.city.enchanter.runeForArmorOnlyWeaponAvailableStory";
		story = i18n.t(key, {
			lng,
			count: data.unenchantedItemsInOtherSlotCount,
			enchantmentId: data.enchantmentId,
			enchantmentType: data.enchantmentType
		});
	}
	else {
		story = i18n.t("commands:report.city.enchanter.allEnchantedStory", { lng });
	}
	return StringUtils.joinParagraphs([story, buildEnchantmentDescription(data, lng)]);
}

function addEnchantableItemsSection(container: ContainerBuilder, data: EnchanterCityData, lng: Language): void {
	if (data.enchantableItems.length === 0) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(buildNoEnchantableItemStory(data, lng))
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
				.setLabel(i18n.t("commands:report.city.buttons.backToCity", { lng }))
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
			collectorTime: params.collectorTime,
			pseudo: params.pseudo
		})
	};
}
