import {
	ActionRowBuilder,
	ButtonBuilder,
	ContainerBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import i18n from "../../../translations/i18n";
import { StringUtils } from "../../../utils/StringUtils";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../Lib/src/Language";
import {
	addCitySection, AddCitySectionParams, createStayInCityButton
} from "./ReportCityMenu";
import { ReportCityButtonStyles } from "./ReportCityMenuConstants";
import { CityMenuParams } from "./ReportCityMenuTypes";

/**
 * Text opening a city sub-menu: its title, addressed to the player, then its description
 */
export type CityMenuHeader = {
	titleKey: string;
	description: string;
};

/**
 * Container of a city sub-menu, starting with its header
 */
export function buildCityMenuContainer(params: CityMenuParams, header: CityMenuHeader): ContainerBuilder {
	return new ContainerBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(i18n.t(header.titleKey, {
				lng: params.interaction.userLanguage,
				pseudo: params.pseudo
			}))),
			new TextDisplayBuilder().setContent(header.description)
		);
}

/**
 * Add a section to a city sub-menu, below a separator
 */
export function addSeparatedCitySection(section: AddCitySectionParams): void {
	section.container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	addCitySection(section);
}

/**
 * Close a city sub-menu with a row of the given buttons followed by the "stay in city" one, below a separator
 */
export function addCityNavigationRow(container: ContainerBuilder, lng: Language, buttons: ButtonBuilder[]): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons, createStayInCityButton(lng))
	);
}

/**
 * Button of a city sub-menu leaving it for a previous menu
 */
export function createCityBackButton(customId: string, label: string, emoji = CrowniclesIcons.city.back): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(customId)
		.setLabel(label)
		.setEmoji(emoji)
		.setStyle(ReportCityButtonStyles.BACK);
}
