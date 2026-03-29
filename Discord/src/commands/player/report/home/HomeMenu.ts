import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle,
	ContainerBuilder, Message,
	SectionBuilder, SeparatorBuilder, SeparatorSpacingSize,
	StringSelectMenuBuilder, StringSelectMenuInteraction,
	TextDisplayBuilder
} from "discord.js";
import { MessageActionRowComponentBuilder } from "@discordjs/builders";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
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

/**
 * Creates a sub-menu for a specific home feature
 */
function createFeatureSubMenu(
	handler: HomeFeatureHandler,
	handlerContext: HomeFeatureHandlerContext,
	params: HomeMenuParams
): CrowniclesNestedMenu {
	const lng = params.interaction.userLanguage;

	// Use custom components if the handler provides them, otherwise build default select menu
	let components: ActionRowBuilder<MessageActionRowComponentBuilder>[];

	if (handler.getSubMenuComponents) {
		components = handler.getSubMenuComponents(handlerContext);
	}
	else {
		// Determine placeholder: allow handler to provide a feature-specific one, fallback to generic
		const placeholder = handler.getSubMenuPlaceholder
			? handler.getSubMenuPlaceholder(handlerContext)
			: i18n.t("commands:report.city.homes.featurePlaceholder", { lng });

		// Build select menu with feature options
		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`HOME_${handler.featureId.toUpperCase()}`)
			.setPlaceholder(placeholder);

		// Add feature-specific options
		handler.addSubMenuOptions(handlerContext, selectMenu);

		// Add back option
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.homes.backToHome", { lng }),
			value: HomeMenuIds.BACK_TO_HOME,
			emoji: CrowniclesIcons.collectors.back
		});

		components = [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)];
	}

	return {
		embed: new CrowniclesEmbed()
			.formatAuthor(handler.getSubMenuTitle(handlerContext, params.pseudo), params.interaction.user)
			.setDescription(handler.getSubMenuDescription(handlerContext)),
		components,
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const componentCollector = message.createMessageComponentCollector({ time: params.collectorTime });

			componentCollector.on("collect", async (componentInteraction: StringSelectMenuInteraction | ButtonInteraction) => {
				if (componentInteraction.user.id !== params.interaction.user.id) {
					await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
					return;
				}

				// Get the selected value from either select menu or button
				const selectedValue = componentInteraction.isStringSelectMenu()
					? componentInteraction.values[0]
					: componentInteraction.customId;

				await handler.handleSubMenuSelection(
					handlerContext,
					selectedValue,
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
export function getHomeMenu(params: HomeMenuParams): CrowniclesNestedMenu {
	const {
		context, interaction, packet, collectorTime, pseudo
	} = params;
	const homeData = (packet.data.data as ReactionCollectorCityData).home.owned!;
	const lng = interaction.userLanguage;

	// Build handler context
	const handlerContext: HomeFeatureHandlerContext = {
		context,
		packet,
		homeData,
		lng,
		user: interaction.user,
		pseudo,
		collectorTime
	};

	// Build home description
	const descriptionParts: string[] = [i18n.t("commands:report.city.homes.homeIntroduction", { lng })];

	// Add feature descriptions
	const featureDescriptions = homeFeatureRegistry.getDescriptionLines(handlerContext);
	if (featureDescriptions.length > 0) {
		descriptionParts.push("", ...featureDescriptions);
	}

	// Build V2 container
	const container = new ContainerBuilder();

	// Title
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t("commands:report.city.homes.homeTitle", {
				lng, pseudo
			})}`
		)
	);

	// Description
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(descriptionParts.join("\n"))
	);

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

	// Feature sections
	const featureOptions = homeFeatureRegistry.getMenuOptions(handlerContext);
	for (const option of featureOptions) {
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
						.setLabel(i18n.t("commands:report.city.buttons.enter", { lng }))
						.setStyle(ButtonStyle.Primary)
				)
		);
	}

	// Leave button
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.LEAVE_HOME)
				.setLabel(i18n.t("commands:report.city.homes.leaveHome", { lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Secondary)
		)
	);

	return {
		containers: [container],
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
