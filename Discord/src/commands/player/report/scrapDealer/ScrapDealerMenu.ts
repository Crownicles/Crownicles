import {
	ActionRowBuilder,
	ButtonBuilder,
	ContainerBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import {
	CrowniclesNestedMenu,
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenuCollectorFactory
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { StringUtils } from "../../../../utils/StringUtils";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	ReactionCollectorCityData,
	ReactionCollectorScrapDealerRecycleReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
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
import { ScrapDealerMenuIds } from "./ScrapDealerMenuConstants";

type ScrapDealerItem = NonNullable<ReactionCollectorCityData["scrapDealer"]>["recyclableItems"][number];

function isScrapDealerRecycleReaction(reaction: {
	type: string;
	data: unknown;
}): reaction is {
	type: string;
	data: ReactionCollectorScrapDealerRecycleReaction;
} {
	if (reaction.type !== ReactionCollectorScrapDealerRecycleReaction.name) {
		return false;
	}
	const data = reaction.data as Record<string, unknown>;
	return typeof data.slot === "number"
		&& typeof data.itemCategory === "number"
		&& typeof data.itemId === "number";
}

function getScrapDealerItemDescription(item: ScrapDealerItem, lng: Language): string {
	return i18n.t("commands:report.city.scrapDealer.itemPreview", {
		lng,
		itemDisplay: DisplayUtils.getItemDisplayWithStatsWithoutMaxValues(item.details, lng),
		materials: formatMaterialLoot(item.recoveredMaterials, lng)
	});
}

function createScrapDealerCollector(params: CityMenuParams): CrowniclesNestedMenuCollectorFactory {
	const {
		context, interaction, packet, collectorTime
	} = params;
	const lng = interaction.userLanguage;

	return (nestedMenus, message): CrowniclesNestedMenuCollector => {
		const collector = message.createMessageComponentCollector({ time: collectorTime });
		collector.on("collect", async buttonInteraction => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			await buttonInteraction.deferUpdate();
			const selectedValue = buttonInteraction.customId;
			if (selectedValue === ScrapDealerMenuIds.BACK_TO_CITY) {
				await nestedMenus.changeToMainMenu();
				return;
			}
			if (selectedValue === ReportCityMenuIds.STAY_IN_CITY) {
				handleStayInCityInteraction(packet, context, buttonInteraction);
				return;
			}
			if (!selectedValue.startsWith(ScrapDealerMenuIds.RECYCLE_ITEM_PREFIX)) {
				return;
			}

			const itemIndex = Number.parseInt(
				selectedValue.slice(ScrapDealerMenuIds.RECYCLE_ITEM_PREFIX.length),
				10
			);
			const item = (packet.data.data as ReactionCollectorCityData).scrapDealer?.recyclableItems[itemIndex];
			if (!item) {
				return;
			}

			const reactionIndex = packet.reactions.findIndex(reaction =>
				isScrapDealerRecycleReaction(reaction)
				&& reaction.data.slot === item.slot
				&& reaction.data.itemCategory === item.category
				&& reaction.data.itemId === item.itemId);
			if (reactionIndex !== -1) {
				DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
			}
		});
		return collector;
	};
}

export function getScrapDealerMenu(params: CityMenuParams): CrowniclesNestedMenu {
	const {
		interaction, packet, pseudo
	} = params;
	const lng = interaction.userLanguage;
	const scrapDealer = (packet.data.data as ReactionCollectorCityData).scrapDealer!;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			StringUtils.formatHeader(i18n.t("commands:report.city.scrapDealer.title", {
				lng, pseudo
			}))
		)
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t(
				scrapDealer.recyclableItems.length > 0
					? "commands:report.city.scrapDealer.description"
					: "commands:report.city.scrapDealer.descriptionNoItems",
				{ lng }
			)
		)
	);

	for (let itemIndex = 0; itemIndex < scrapDealer.recyclableItems.length; itemIndex++) {
		const item = scrapDealer.recyclableItems[itemIndex];
		container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
		addCitySection({
			container,
			text: getScrapDealerItemDescription(item, lng),
			emoji: CrowniclesIcons.city.services.scrapDealer,
			customId: `${ScrapDealerMenuIds.RECYCLE_ITEM_PREFIX}${itemIndex}`,
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
		createCollector: createScrapDealerCollector(params)
	};
}

export function getScrapDealerMenus(params: CityMenuParams): Map<string, CrowniclesNestedMenu> {
	return new Map([[ScrapDealerMenuIds.SCRAP_DEALER_MENU, getScrapDealerMenu(params)]]);
}
