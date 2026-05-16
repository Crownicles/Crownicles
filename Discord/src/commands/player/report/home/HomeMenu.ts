import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
	ContainerBuilder, Message,
	SectionBuilder, SeparatorBuilder, SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import i18n from "../../../../translations/i18n";
import { ReactionCollectorCityData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenuCollector
} from "../../../../messages/CrowniclesNestedMenus";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { homeFeatureRegistry } from "./HomeFeatureRegistry";
import {
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeMenuParams
} from "./HomeMenuTypes";
import { HomeMenuIds } from "./HomeMenuConstants";
import {
	createStayInCityButton, handleStayInCityInteraction
} from "../ReportCityMenu";
import { ReportCityMenuIds } from "../ReportCityMenuConstants";
import { StringUtils } from "../../../../utils/StringUtils";
import { Language } from "../../../../../../Lib/src/Language";

/**
 * Creates a sub-menu for a specific home feature
 */
function createFeatureSubMenu(
	handler: HomeFeatureHandler,
	handlerContext: HomeFeatureHandlerContext,
	params: HomeMenuParams
): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;

	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${handler.getSubMenuTitle(handlerContext, params.pseudo)}`
		)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(handler.getSubMenuDescription(handlerContext))
	);

	handler.addSubMenuContainerContent(handlerContext, container);

	return {
		containers: [container],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const componentCollector = message.createMessageComponentCollector({ time: params.collectorTime });

			componentCollector.on("collect", async (componentInteraction: ButtonInteraction) => {
				if (componentInteraction.user.id !== params.interaction.user.id) {
					await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
					return;
				}

				if (componentInteraction.customId === ReportCityMenuIds.STAY_IN_CITY) {
					await componentInteraction.deferUpdate();
					handleStayInCityInteraction(params.packet, params.context, componentInteraction);
					return;
				}

				await handler.handleSubMenuSelection(
					handlerContext,
					componentInteraction.customId,
					componentInteraction,
					nestedMenus
				);
			});

			return componentCollector;
		}
	};
}

/**
 * Creates the main home menu for players to access home features.
 *
 * This menu displays available features (upgrade station, bed, chest, etc.)
 * and allows navigation to sub-menus for each feature.
 *
 * @param params - Parameters for creating the home menu
 */
/**
 * Build the V2 container for the main home menu: title, intro + feature
 * descriptions, one section per available feature, and the footer buttons
 * (leave home/apartment + stay in city).
 */
function buildMainHomeHeader(handlerContext: HomeFeatureHandlerContext, isApartment: boolean, pseudo: string): TextDisplayBuilder {
	const { lng } = handlerContext;
	return new TextDisplayBuilder().setContent(
		StringUtils.formatHeader(i18n.t(
			isApartment
				? "commands:report.city.homes.apartmentTitle"
				: "commands:report.city.homes.homeTitle",
			{
				lng, pseudo
			}
		))
	);
}

function buildMainHomeDescription(handlerContext: HomeFeatureHandlerContext, isApartment: boolean): TextDisplayBuilder {
	const { lng } = handlerContext;
	const descriptionParts: string[] = [
		i18n.t(
			isApartment
				? "commands:report.city.homes.apartmentIntroduction"
				: "commands:report.city.homes.homeIntroduction",
			{ lng }
		)
	];
	const featureDescriptions = homeFeatureRegistry.getDescriptionLines(handlerContext);
	if (featureDescriptions.length > 0) {
		descriptionParts.push("", ...featureDescriptions);
	}
	return new TextDisplayBuilder().setContent(descriptionParts.join("\n"));
}

function buildMainHomeFooterRow(lng: Language, isApartment: boolean): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(HomeMenuIds.LEAVE_HOME)
			.setLabel(i18n.t(
				isApartment
					? "commands:report.city.homes.leaveApartment"
					: "commands:report.city.homes.leaveHome",
				{ lng }
			))
			.setEmoji(CrowniclesIcons.collectors.back)
			.setStyle(ButtonStyle.Secondary),
		createStayInCityButton(lng)
	);
}

function buildMainHomeContainer(
	handlerContext: HomeFeatureHandlerContext,
	isApartment: boolean,
	pseudo: string
): ContainerBuilder {
	const { lng } = handlerContext;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(buildMainHomeHeader(handlerContext, isApartment, pseudo));
	container.addTextDisplayComponents(buildMainHomeDescription(handlerContext, isApartment));
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	for (const option of homeFeatureRegistry.getMenuOptions(handlerContext)) {
		container.addSectionComponents(
			new SectionBuilder()
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						`${option.emoji} **${option.label}**${option.description ? `\n${option.description}` : ""}`
					)
				)
				.setButtonAccessory(
					new ButtonBuilder()
						.setCustomId(option.value)
						.setLabel(option.buttonLabel)
						.setEmoji(option.emoji)
						.setStyle(ButtonStyle.Primary)
				)
		);
	}

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(buildMainHomeFooterRow(lng, isApartment));

	return container;
}

export function getHomeMenu(params: HomeMenuParams): CrowniclesNestedMenu {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const homeData = (packet.data.data as ReactionCollectorCityData).home.owned!;
	const isApartment = Boolean(homeData.isApartment);
	const lng = interaction.userLanguage;

	const handlerContext: HomeFeatureHandlerContext = {
		context,
		packet,
		homeData,
		lng,
		user: interaction.user,
		pseudo,
		collectorTime
	};

	return {
		containers: [buildMainHomeContainer(handlerContext, isApartment, pseudo)],
		createCollector: (nestedMenus, message: Message): CrowniclesNestedMenuCollector => {
			const collector = message.createMessageComponentCollector({ time: collectorTime });

			collector.on("collect", async (componentInteraction: ButtonInteraction) => {
				if (componentInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
					return;
				}

				const selectedValue = componentInteraction.customId;

				// Handle leave home
				if (selectedValue === HomeMenuIds.LEAVE_HOME) {
					await componentInteraction.deferUpdate();
					await nestedMenus.changeToMainMenu();
					return;
				}

				// Handle stay in city
				if (selectedValue === ReportCityMenuIds.STAY_IN_CITY) {
					await componentInteraction.deferUpdate();
					handleStayInCityInteraction(packet, context, componentInteraction);
					return;
				}

				// Handle feature selection (each handler decides its own defer strategy)
				await homeFeatureRegistry.handleMainMenuSelection(
					handlerContext,
					selectedValue,
					componentInteraction,
					nestedMenus
				);
			});

			return collector;
		}
	};
}

/**
 * Get all home sub-menus for registration in the nested menu system
 */
export function getHomeSubMenus(params: HomeMenuParams): Map<string, CrowniclesNestedMenu> {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const homeData = (packet.data.data as ReactionCollectorCityData).home.owned!;
	const lng = interaction.userLanguage;

	const handlerContext: HomeFeatureHandlerContext = {
		context,
		packet,
		homeData,
		lng,
		user: interaction.user,
		pseudo,
		collectorTime
	};

	const subMenus = new Map<string, CrowniclesNestedMenu>();

	// Create sub-menus for each available feature
	for (const handler of homeFeatureRegistry.getAvailableHandlers(handlerContext)) {
		const option = handler.getMenuOption(handlerContext);
		if (option) {
			subMenus.set(
				option.value,
				createFeatureSubMenu(handler, handlerContext, params)
			);
		}
	}

	return subMenus;
}
