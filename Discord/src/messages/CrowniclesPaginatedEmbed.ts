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

const PAGINATION_CUSTOM_IDS = {
	PREVIOUS: "previous",
	NEXT: "next",
	OPEN_EXTRA_PAGE: "openExtraPage",
	BACK: "back"
} as const;

type PaginationButtons = {
	previous: ButtonBuilder;
	next: ButtonBuilder;
	extraPage?: {
		open: ButtonBuilder;
		back: ButtonBuilder;
	};
};

type PaginatedEmbedView = {
	embeds: CrowniclesEmbed[];
	components: ActionRowBuilder<ButtonBuilder>[];
};

type PaginatedEmbedButtonLabel = {
	label: string;
	emoji: string;
};

/**
 * A page reached with its own button rather than with the page navigation, e.g. a summary of the paginated content
 */
export type CrowniclesPaginatedEmbedExtraPage = {
	title: string;
	content: string;
	openButton: PaginatedEmbedButtonLabel;
	backButton: PaginatedEmbedButtonLabel;
};

/**
 * Options for the paginated embed
 */
export type CrowniclesPaginatedEmbedOptions = {

	/**
	 * Pre-built page descriptions
	 * Use this OR pageBuilder, not both
	 */
	pages?: string[];

	/**
	 * Lazy page builder function, called on-demand when a page is displayed.
	 * Use this OR pages, not both. Requires pagesCount to be set.
	 */
	pageBuilder?: (pageIndex: number) => Promise<string>;

	/**
	 * Dynamic title builder, called per page. Overrides setTitle.
	 */
	titleBuilder?: (pageIndex: number) => string;

	/**
	 * Total number of pages (required when using pageBuilder)
	 */
	pagesCount?: number;

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

	/**
	 * A page outside of the navigation, opened with its own button shown next to the navigation ones
	 */
	extraPage?: CrowniclesPaginatedEmbedExtraPage;
};

/**
 * Class for the paginated embed
 * Use the send method to send the embed
 */
export class CrowniclesPaginatedEmbed extends CrowniclesEmbed {
	private readonly options: CrowniclesPaginatedEmbedOptions;

	private readonly pageCache: Map<number, string> = new Map();

	// Title of the pages, saved when opening the extra page and put back when leaving it
	private pagesTitle?: string | null;

	constructor(options: CrowniclesPaginatedEmbedOptions) {
		super();
		this.options = options;
	}

	private applyTitle(pageIndex: number): void {
		if (this.options.titleBuilder) {
			this.setTitle(this.options.titleBuilder(pageIndex));
		}
	}

	private getTotalPages(): number {
		return this.options.pages ? this.options.pages.length : this.options.pagesCount!;
	}

	private async getPage(index: number): Promise<string> {
		if (this.options.pages) {
			return this.options.pages[index];
		}
		const cached = this.pageCache.get(index);
		if (cached !== undefined) {
			return cached;
		}
		const page = await this.options.pageBuilder!(index);
		this.pageCache.set(index, page);
		return page;
	}

	/**
	 * Create the buttons of the embed: the page navigation, and the ones to open and leave the extra page if any
	 */
	private createButtons(): PaginationButtons {
		const createButton = (customId: string, emoji: string, label?: string): ButtonBuilder => {
			const button = new ButtonBuilder()
				.setEmoji(emoji)
				.setCustomId(customId)
				.setStyle(ButtonStyle.Secondary);
			return label ? button.setLabel(label) : button;
		};
		const extraPage = this.options.extraPage;
		return {
			previous: createButton(PAGINATION_CUSTOM_IDS.PREVIOUS, CrowniclesIcons.collectors.previousPage),
			next: createButton(PAGINATION_CUSTOM_IDS.NEXT, CrowniclesIcons.collectors.nextPage),
			...extraPage
				? {
					extraPage: {
						open: createButton(PAGINATION_CUSTOM_IDS.OPEN_EXTRA_PAGE, extraPage.openButton.emoji, extraPage.openButton.label),
						back: createButton(PAGINATION_CUSTOM_IDS.BACK, extraPage.backButton.emoji, extraPage.backButton.label)
					}
				}
				: {}
		};
	}

	/**
	 * Build the view of a page of the navigation
	 * @param pageIndex
	 * @param buttons
	 */
	private async buildPageView(pageIndex: number, buttons: PaginationButtons): Promise<PaginatedEmbedView> {
		const pageContent = await this.getPage(pageIndex);
		if (this.pagesTitle !== undefined) {
			this.setTitle(this.pagesTitle);
		}
		this.applyTitle(pageIndex);
		const totalPages = this.getTotalPages();
		return {
			embeds: [this.setDescription(pageContent).setFooter(CrowniclesPaginatedEmbed.getPageFooter(pageIndex, totalPages, this.options.lng))],
			components: CrowniclesPaginatedEmbed.getPageComponents(pageIndex, totalPages, buttons)
		};
	}

	/**
	 * Build the view of the extra page, which only offers to go back to the pages
	 * @param extraPage
	 * @param backButton
	 */
	private buildExtraPageView(extraPage: CrowniclesPaginatedEmbedExtraPage, backButton: ButtonBuilder): PaginatedEmbedView {
		this.pagesTitle = this.data.title ?? null;
		return {
			embeds: [
				this.setTitle(extraPage.title)
					.setDescription(extraPage.content)
					.setFooter(null)
			],
			components: [new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)]
		};
	}

	/**
	 * Send the paginated embed
	 * @param originalInteraction
	 */
	async send(originalInteraction: CrowniclesInteraction): Promise<void> {
		let currentPage = this.options.selectedPageIndex ?? 0;
		let onExtraPage = false;
		const buttons = this.createButtons();
		const buildView = async (): Promise<PaginatedEmbedView> => onExtraPage && this.options.extraPage && buttons.extraPage
			? this.buildExtraPageView(this.options.extraPage, buttons.extraPage.back)
			: await this.buildPageView(currentPage, buttons);

		const msg = await originalInteraction.editReply(await buildView());

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

			switch (buttonInteraction.customId) {
				case PAGINATION_CUSTOM_IDS.PREVIOUS:
					currentPage--;
					break;
				case PAGINATION_CUSTOM_IDS.NEXT:
					currentPage++;
					break;
				default:
					onExtraPage = buttonInteraction.customId === PAGINATION_CUSTOM_IDS.OPEN_EXTRA_PAGE;
			}

			await buttonInteraction.update(await buildView());
		});

		collector.on("end", async () => {
			const shownButtons = onExtraPage && buttons.extraPage
				? [buttons.extraPage.back]
				: [
					buttons.previous,
					buttons.next,
					...buttons.extraPage ? [buttons.extraPage.open] : []
				];

			await msg.edit({
				components: [
					new ActionRowBuilder<ButtonBuilder>()
						.addComponents(shownButtons.map(button => button.setDisabled(true)))
				]
			});
		});
	}

	/**
	 * Get the page components for the pagination
	 * @param currentPage - The current page
	 * @param pagesCount - The total number of pages
	 * @param buttons - The buttons of the embed
	 */
	private static getPageComponents(currentPage: number, pagesCount: number, buttons: PaginationButtons): ActionRowBuilder<ButtonBuilder>[] {
		const components = pagesCount > 1
			? [buttons.previous.setDisabled(currentPage <= 0), buttons.next.setDisabled(currentPage >= pagesCount - 1)]
			: [];
		if (buttons.extraPage) {
			components.push(buttons.extraPage.open);
		}

		return components.length === 0
			? []
			: [
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
