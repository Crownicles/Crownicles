import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ContainerBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenuCollectorFactory,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { StringUtils } from "../../../../utils/StringUtils";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	ReactionCollectorCityData,
	ReactionCollectorScrapDealerRecycleReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ScrapDealerItem } from "../../../../../../Lib/src/types/ScrapDealerData";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { formatMaterialLoot } from "../../../../utils/MaterialLootDisplayUtils";
import { Language } from "../../../../../../Lib/src/Language";
import {
	addCitySection,
	createStayInCityButton,
	handleStayInCityInteraction
} from "../ReportCityMenu";
import {
	ReportCityButtonStyles,
	ReportCityMenuIds
} from "../ReportCityMenuConstants";
import { CityMenuParams } from "../ReportCityMenuTypes";
import {
	getScrapDealerDetailMenuId, ScrapDealerMenuIds
} from "./ScrapDealerMenuConstants";

function getRecyclableItems(params: CityMenuParams): ScrapDealerItem[] {
	return (params.packet.data.data as ReactionCollectorCityData).scrapDealer?.recyclableItems ?? [];
}

function isScrapDealerRecycleReaction(reaction: {
	type: string;
	data: unknown;
}): reaction is {
	type: string;
	data: ReactionCollectorScrapDealerRecycleReaction;
} {
	return reaction.type === ReactionCollectorScrapDealerRecycleReaction.name;
}

function getScrapDealerItemDescription(item: ScrapDealerItem, lng: Language): string {
	return i18n.t("commands:report.city.scrapDealer.itemPreview", {
		lng,
		itemDisplay: DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng),
		materials: formatMaterialLoot(item.recoveredMaterials, lng)
	});
}

/**
 * Route the interactions shared by the scrap dealer list and confirmation views.
 * @returns Whether the interaction was handled.
 */
async function handleSharedScrapDealerInteraction(
	params: CityMenuParams,
	nestedMenus: CrowniclesNestedMenus,
	buttonInteraction: ButtonInteraction
): Promise<boolean> {
	if (buttonInteraction.customId === ScrapDealerMenuIds.BACK_TO_CITY) {
		await buttonInteraction.deferUpdate();
		await nestedMenus.changeToMainMenu();
		return true;
	}
	if (buttonInteraction.customId === ReportCityMenuIds.STAY_IN_CITY) {
		await buttonInteraction.deferUpdate();
		handleStayInCityInteraction(params.packet, params.context, buttonInteraction);
		return true;
	}
	return false;
}

function createScrapDealerListCollector(params: CityMenuParams): CrowniclesNestedMenuCollectorFactory {
	const {
		interaction, collectorTime
	} = params;
	const lng = interaction.userLanguage;

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });
		collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			if (await handleSharedScrapDealerInteraction(params, nestedMenus, buttonInteraction)) {
				return;
			}
			if (!buttonInteraction.customId.startsWith(ScrapDealerMenuIds.SELECT_ITEM_PREFIX)) {
				return;
			}

			await buttonInteraction.deferUpdate();
			const itemIndex = Number.parseInt(
				buttonInteraction.customId.slice(ScrapDealerMenuIds.SELECT_ITEM_PREFIX.length),
				10
			);
			await nestedMenus.changeMenu(getScrapDealerDetailMenuId(itemIndex));
		});
		return collector;
	};
}

function createScrapDealerConfirmCollector(params: CityMenuParams, item: ScrapDealerItem): CrowniclesNestedMenuCollectorFactory {
	const {
		context, interaction, packet, collectorTime
	} = params;
	const lng = interaction.userLanguage;

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });
		collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			if (await handleSharedScrapDealerInteraction(params, nestedMenus, buttonInteraction)) {
				return;
			}
			if (buttonInteraction.customId === ScrapDealerMenuIds.BACK_TO_LIST) {
				await buttonInteraction.deferUpdate();
				await nestedMenus.changeMenu(ScrapDealerMenuIds.SCRAP_DEALER_MENU);
				return;
			}
			if (buttonInteraction.customId !== ScrapDealerMenuIds.CONFIRM_RECYCLE) {
				return;
			}

			await buttonInteraction.deferReply();
			const reactionIndex = packet.reactions.findIndex(reaction =>
				isScrapDealerRecycleReaction(reaction)
				&& reaction.data.slot === item.slot
				&& reaction.data.itemCategory === item.category
				&& reaction.data.itemId === item.itemId);
			if (reactionIndex === -1) {
				CrowniclesLogger.error(`Scrap dealer recycle reaction not found for slot ${item.slot}, category ${item.category}`);
				await buttonInteraction.deleteReply();
				return;
			}
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
		});
		return collector;
	};
}

function buildScrapDealerContainer(titleKey: string, description: string, params: CityMenuParams): ContainerBuilder {
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			StringUtils.formatHeader(i18n.t(titleKey, {
				lng: params.interaction.userLanguage,
				pseudo: params.pseudo
			}))
		)
	);
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
	return container;
}

function getScrapDealerListMenu(params: CityMenuParams): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const recyclableItems = getRecyclableItems(params);
	const container = buildScrapDealerContainer(
		"commands:report.city.scrapDealer.title",
		i18n.t(
			recyclableItems.length > 0
				? "commands:report.city.scrapDealer.description"
				: "commands:report.city.scrapDealer.descriptionNoItems",
			{ lng }
		),
		params
	);

	for (let itemIndex = 0; itemIndex < recyclableItems.length; itemIndex++) {
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			text: getScrapDealerItemDescription(recyclableItems[itemIndex], lng),
			emoji: CrowniclesIcons.city.services.scrapDealer,
			customId: `${ScrapDealerMenuIds.SELECT_ITEM_PREFIX}${itemIndex}`,
			buttonLabel: i18n.t("commands:report.city.buttons.recycle", { lng }),
			buttonStyle: ReportCityButtonStyles.CONFIRM
		});
	}

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ScrapDealerMenuIds.BACK_TO_CITY)
				.setLabel(i18n.t("commands:report.city.scrapDealer.backToCity", { lng }))
				.setEmoji(CrowniclesIcons.city.exit)
				.setStyle(ReportCityButtonStyles.BACK),
			createStayInCityButton(lng)
		)
	);

	return {
		containers: [container],
		createCollector: createScrapDealerListCollector(params)
	};
}

function getScrapDealerConfirmMenu(params: CityMenuParams, itemIndex: number): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;
	const item = getRecyclableItems(params)[itemIndex];
	const container = buildScrapDealerContainer(
		"commands:report.city.scrapDealer.confirmTitle",
		i18n.t("commands:report.city.scrapDealer.confirmDescription", {
			lng,
			itemDisplay: DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng),
			materials: formatMaterialLoot(item.recoveredMaterials, lng)
		}),
		params
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(ScrapDealerMenuIds.CONFIRM_RECYCLE)
				.setLabel(i18n.t("commands:report.city.scrapDealer.confirmRecycle", { lng }))
				.setEmoji(CrowniclesIcons.city.services.scrapDealer)
				.setStyle(ReportCityButtonStyles.DESTRUCTIVE),
			new ButtonBuilder()
				.setCustomId(ScrapDealerMenuIds.BACK_TO_LIST)
				.setLabel(i18n.t("commands:report.city.scrapDealer.backToItems", { lng }))
				.setEmoji(CrowniclesIcons.city.back)
				.setStyle(ReportCityButtonStyles.BACK),
			createStayInCityButton(lng)
		)
	);

	return {
		containers: [container],
		createCollector: createScrapDealerConfirmCollector(params, item)
	};
}

export function getScrapDealerMenus(params: CityMenuParams): Map<string, CrowniclesNestedMenu> {
	const menus = new Map<string, CrowniclesNestedMenu>([[ScrapDealerMenuIds.SCRAP_DEALER_MENU, getScrapDealerListMenu(params)]]);
	const recyclableItems = getRecyclableItems(params);
	for (let itemIndex = 0; itemIndex < recyclableItems.length; itemIndex++) {
		menus.set(getScrapDealerDetailMenuId(itemIndex), getScrapDealerConfirmMenu(params, itemIndex));
	}
	return menus;
}
