import {
	ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction
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
import { HomeFeatureHandlerContext } from "./HomeMenuTypes";

/**
 * Creates the home menu for players to access home features.
 *
 * This menu uses a registry pattern to support multiple home features.
 * Each feature is handled by a dedicated handler (see HomeFeatureHandler interface).
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

	// Build description with introduction and feature-specific lines
	const descriptionParts: string[] = [i18n.t("commands:report.city.homes.homeIntroduction", { lng })];

	// Add description lines from all available features
	const featureDescriptions = homeFeatureRegistry.buildDescription(handlerContext);
	if (featureDescriptions.length > 0) {
		descriptionParts.push("", ...featureDescriptions);
	}

	const description = descriptionParts.join("\n");

	// Build select menu
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("HOME_MENU")
		.setPlaceholder(i18n.t("commands:report.city.homes.homePlaceholder", { lng }));

	// Add options from all available features
	homeFeatureRegistry.addAllMenuOptions(handlerContext, selectMenu);

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
				await homeFeatureRegistry.handleSelection(
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
