import {
	ActionRowBuilder, ButtonInteraction, StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCityData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import {
	CrowniclesNestedMenu, CrowniclesNestedMenuCollector
} from "../../../../messages/CrowniclesNestedMenus";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { homeFeatureRegistry } from "./HomeFeatureRegistry";
import {
	HomeFeatureHandler, HomeFeatureHandlerContext
} from "./HomeMenuTypes";

/**
 * Creates a sub-menu for a specific home feature
 */
function createFeatureSubMenu(
	handler: HomeFeatureHandler,
	handlerContext: HomeFeatureHandlerContext,
	interaction: CrowniclesInteraction,
	collectorTime: number,
	pseudo: string
): CrowniclesNestedMenu {
	const lng = interaction.userLanguage;

	// Build select menu with feature options
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`HOME_${handler.featureId.toUpperCase()}`)
		.setPlaceholder(i18n.t("commands:report.city.homes.featurePlaceholder", { lng }));

	// Add feature-specific options
	handler.addSubMenuOptions(handlerContext, selectMenu);

	// Add back option
	selectMenu.addOptions({
		label: i18n.t("commands:report.city.homes.backToHome", { lng }),
		value: "BACK_TO_HOME",
		emoji: CrowniclesIcons.collectors.back
	});

	return {
		embed: new CrowniclesEmbed()
			.formatAuthor(handler.getSubMenuTitle(handlerContext, pseudo), interaction.user)
			.setDescription(handler.getSubMenuDescription(handlerContext)),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const componentCollector = message.createMessageComponentCollector({ time: collectorTime });

			componentCollector.on("collect", async (componentInteraction: StringSelectMenuInteraction | ButtonInteraction) => {
				if (componentInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
					return;
				}

				// Get the selected value from either select menu or button
				const selectedValue = componentInteraction.isStringSelectMenu()
					? componentInteraction.values[0]
					: componentInteraction.customId;

				await homeFeatureRegistry.handleSubMenuSelection(
					handler,
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
 * @param context - The packet context
 * @param interaction - The Discord interaction
 * @param packet - The reaction collector packet containing home data
 * @param collectorTime - Time before collector expires
 * @param pseudo - Player's display name
 */
export function getHomeMenu(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	collectorTime: number,
	pseudo: string
): CrowniclesNestedMenu {
	const homeData = (packet.data.data as ReactionCollectorCityData).home.owned!;
	const lng = interaction.userLanguage;

	// Build handler context
	const handlerContext: HomeFeatureHandlerContext = {
		context,
		packet,
		homeData,
		lng
	};

	// Build description with introduction and available features
	const descriptionParts: string[] = [i18n.t("commands:report.city.homes.homeIntroduction", { lng })];

	const featureDescriptions = homeFeatureRegistry.buildDescription(handlerContext);
	if (featureDescriptions.length > 0) {
		descriptionParts.push("", ...featureDescriptions);
	}

	const description = descriptionParts.join("\n");

	// Build select menu with feature options
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("HOME_MENU")
		.setPlaceholder(i18n.t("commands:report.city.homes.homePlaceholder", { lng }));

	// Add feature options from all available handlers
	const menuOptions = homeFeatureRegistry.getMenuOptions(handlerContext);
	for (const option of menuOptions) {
		selectMenu.addOptions({
			label: option.label,
			description: option.description,
			value: option.value,
			emoji: option.emoji
		});
	}

	// Add back option (always present)
	selectMenu.addOptions({
		label: i18n.t("commands:report.city.homes.leaveHome", { lng }),
		value: "BACK_TO_CITY",
		emoji: CrowniclesIcons.city.exit
	});

	return {
		embed: new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:report.city.homes.homeTitle", {
				lng,
				pseudo
			}), interaction.user)
			.setDescription(description),
		components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
		createCollector: (nestedMenus, message): CrowniclesNestedMenuCollector => {
			const selectMenuCollector = message.createMessageComponentCollector({ time: collectorTime });

			selectMenuCollector.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
				if (selectInteraction.user.id !== interaction.user.id) {
					await sendInteractionNotForYou(selectInteraction.user, selectInteraction, lng);
					return;
				}

				const selectedValue = selectInteraction.values[0];

				// Handle back to city
				if (selectedValue === "BACK_TO_CITY") {
					await selectInteraction.deferUpdate();
					await nestedMenus.changeToMainMenu();
					return;
				}

				// Delegate to registered feature handlers
				await homeFeatureRegistry.handleMainMenuSelection(
					handlerContext,
					selectedValue,
					selectInteraction,
					nestedMenus
				);
			});

			return selectMenuCollector;
		}
	};
}

/**
 * Get all home sub-menus for registration in the nested menu system
 */
export function getHomeSubMenus(
	context: PacketContext,
	interaction: CrowniclesInteraction,
	packet: ReactionCollectorCreationPacket,
	collectorTime: number,
	pseudo: string
): Map<string, CrowniclesNestedMenu> {
	const homeData = (packet.data.data as ReactionCollectorCityData).home.owned!;
	const lng = interaction.userLanguage;

	const handlerContext: HomeFeatureHandlerContext = {
		context,
		packet,
		homeData,
		lng
	};

	const subMenus = new Map<string, CrowniclesNestedMenu>();

	// Create sub-menus for each available feature
	for (const handler of homeFeatureRegistry.getAvailableHandlers(handlerContext)) {
		const option = handler.getMenuOption(handlerContext);
		if (option) {
			subMenus.set(
				option.value,
				createFeatureSubMenu(handler, handlerContext, interaction, collectorTime, pseudo)
			);
		}
	}

	return subMenus;
}
