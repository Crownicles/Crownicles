import { CrowniclesEmbed } from "./CrowniclesEmbed";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle
} from "discord.js";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { CrowniclesInteraction } from "./CrowniclesInteraction";
import { Language } from "../../../Lib/src/Language";
import { Constants } from "../../../Lib/src/constants/Constants";
import i18n from "../translations/i18n";

/**
 * Options for the paginated embed
 */
export type CrowniclesPaginatedEmbedOptions = {
	pages: string[];

	lng: Language;

	/**
	 * The time in milliseconds to wait before closing the collector
	 * If not set, the default time is used
	 */
	collectorTime?: number;

	/**
	 * The ids of the users allowed to use the embed
	 * If not set, only the original user can use it
	 */
	allowedUserIds?: string[];

	/**
	 * The index of the page to start on
	 * Starts at 0
	 */
	selectedPageIndex?: number;
};

/**
 * Class for the paginated embed
 * Use the send method to send the embed
 */
export class CrowniclesPaginatedEmbed extends CrowniclesEmbed {
	private readonly options: CrowniclesPaginatedEmbedOptions;

	constructor(options: CrowniclesPaginatedEmbedOptions) {
		super();
		this.options = options;
	}

	/**
	 * Send the paginated embed
	 * @param originalInteraction
	 */
	async send(originalInteraction: CrowniclesInteraction): Promise<void> {
		let currentPage = this.options.selectedPageIndex ?? 0;

		const previousCustomId = "previous";
		const nextCustomId = "next";
		const previousButton = new ButtonBuilder()
			.setEmoji(CrowniclesIcons.collectors.previousPage)
			.setCustomId(previousCustomId)
			.setStyle(ButtonStyle.Secondary);
		const nextButton = new ButtonBuilder()
			.setEmoji(CrowniclesIcons.collectors.nextPage)
			.setCustomId(nextCustomId)
			.setStyle(ButtonStyle.Secondary);

		const msg = await originalInteraction.editReply({
			embeds: [this.setDescription(this.options.pages[currentPage]).setFooter(CrowniclesPaginatedEmbed.getPageFooter(currentPage, this.options.pages.length, this.options.lng))],
			components: CrowniclesPaginatedEmbed.getPageComponents(currentPage, this.options.pages.length, previousButton, nextButton)
		});

		if (!msg) {
			return;
		}

		const collector = msg.createMessageComponentCollector({
			time: this.options.collectorTime ?? Constants.MESSAGES.COLLECTOR_TIME
		});

		collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (this.options.allowedUserIds
				? !this.options.allowedUserIds.includes(buttonInteraction.user.id)
				: buttonInteraction.user.id !== originalInteraction.user.id
			) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, this.options.lng);
				return;
			}

			if (buttonInteraction.customId === previousCustomId) {
				currentPage--;
			}
			else if (buttonInteraction.customId === nextCustomId) {
				currentPage++;
			}

			await buttonInteraction.update({
				embeds: [this.setDescription(this.options.pages[currentPage]).setFooter(CrowniclesPaginatedEmbed.getPageFooter(currentPage, this.options.pages.length, this.options.lng))],
				components: CrowniclesPaginatedEmbed.getPageComponents(currentPage, this.options.pages.length, previousButton, nextButton)
			});
		});

		collector.on("end", async () => {
			const disabledComponents = CrowniclesPaginatedEmbed.getPageComponents(currentPage, this.options.pages.length, previousButton.setDisabled(true), nextButton.setDisabled(true));

			await msg.edit({
				components: disabledComponents
			});
		});
	}

	/**
	 * Get the page components for the pagination
	 * @param currentPage - The current page
	 * @param pagesCount - The total number of pages
	 * @param previousButton - The previous button
	 * @param nextButton - The next button
	 */
	private static getPageComponents(currentPage: number, pagesCount: number, previousButton: ButtonBuilder, nextButton: ButtonBuilder): ActionRowBuilder<ButtonBuilder>[] {
		if (pagesCount <= 1) {
			return [];
		}

		const components = [];
		if (currentPage > 0) {
			components.push(previousButton.setDisabled(false));
		}
		else {
			components.push(previousButton.setDisabled(true));
		}
		if (currentPage < pagesCount - 1) {
			components.push(nextButton.setDisabled(false));
		}
		else {
			components.push(nextButton.setDisabled(true));
		}
		return [
			new ActionRowBuilder<ButtonBuilder>()
				.addComponents(components)
		];
	}

	/**
	 * Get the footer for the fight history message
	 * @param currentPage
	 * @param totalPages
	 * @param lng
	 */
	private static getPageFooter(currentPage: number, totalPages: number, lng: Language): { text: string } {
		return {
			text: i18n.t("embeds:paginated.footer", {
				lng,
				page: currentPage + 1,
				total: totalPages
			})
		};
	}
}
