import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Message,
	MessageComponentInteraction, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder
} from "discord.js";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../Lib/src/Language";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import {
	CrowniclesNestedMenuCollector,
	CrowniclesNestedMenus
} from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { StringUtils } from "../../../../utils/StringUtils";
import { createCityCollector } from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";

type CityConfirmationAction = {
	buttonInteraction: MessageComponentInteraction;
	nestedMenus: CrowniclesNestedMenus;
};

export type CityConfirmationMenuConfig = {
	interaction: CrowniclesInteraction;
	collectorTime: number;
	lng: Language;
	title: string;
	description: string;
	confirmLabel: string;
	confirmEmoji?: string;
	confirmStyle?: ButtonStyle;
	backMenuId: string;
	onConfirm: (action: CityConfirmationAction) => Promise<void>;
};

function buildCityConfirmationContainer(config: CityConfirmationMenuConfig): ContainerBuilder {
	const container = new ContainerBuilder();
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(StringUtils.formatHeader(config.title))
	);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(config.description)
	);
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	const confirmButton = new ButtonBuilder()
		.setCustomId(ReportCityMenuIds.CITY_CONFIRMATION_CONFIRM)
		.setLabel(config.confirmLabel)
		.setEmoji(config.confirmEmoji ?? CrowniclesIcons.collectors.accept)
		.setStyle(config.confirmStyle ?? ButtonStyle.Success);

	const cancelButton = new ButtonBuilder()
		.setCustomId(ReportCityMenuIds.CITY_CONFIRMATION_CANCEL)
		.setLabel(i18n.t("commands:report.city.confirmation.cancel", { lng: config.lng }))
		.setEmoji(CrowniclesIcons.collectors.refuse)
		.setStyle(ButtonStyle.Secondary);

	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton)
	);

	return container;
}

function createCityConfirmationCollector(
	config: CityConfirmationMenuConfig
): (nestedMenus: CrowniclesNestedMenus, message: Message) => CrowniclesNestedMenuCollector {
	return createCityCollector(config.interaction, config.collectorTime, async (customId, buttonInteraction, nestedMenus) => {
		if (customId === ReportCityMenuIds.CITY_CONFIRMATION_CONFIRM) {
			await config.onConfirm({
				buttonInteraction,
				nestedMenus
			});
			return;
		}

		if (customId === ReportCityMenuIds.CITY_CONFIRMATION_CANCEL) {
			await buttonInteraction.deferUpdate();
			await nestedMenus.changeMenu(config.backMenuId);
		}
	});
}

export function registerCityConfirmationMenu(
	nestedMenus: CrowniclesNestedMenus,
	config: CityConfirmationMenuConfig
): void {
	nestedMenus.registerMenu(ReportCityMenuIds.CITY_CONFIRMATION_MENU, {
		containers: [buildCityConfirmationContainer(config)],
		createCollector: createCityConfirmationCollector(config)
	});
}
