import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", () => ({
	crowniclesClient: {}
}));
vi.mock("../../src/translations/i18n", () => ({
	default: { t: (key: string): string => key }
}));
vi.mock("../../src/utils/ErrorUtils", () => ({
	sendInteractionNotForYou: vi.fn()
}));

import {
	ActionRowBuilder, APIButtonComponentWithCustomId, APIEmbed, ButtonBuilder
} from "discord.js";
import { CrowniclesPaginatedEmbed } from "../../src/messages/CrowniclesPaginatedEmbed";
import { CrowniclesInteraction } from "../../src/messages/CrowniclesInteraction";
import { CrowniclesEmbed } from "../../src/messages/CrowniclesEmbed";

type View = {
	embeds: CrowniclesEmbed[];
	components: ActionRowBuilder<ButtonBuilder>[];
};

type JsonView = {
	embeds: APIEmbed[];
	customIds: string[];
	disabled: boolean[];
};

const USER_ID = "user-id";

function toJson(view: View): JsonView {
	const buttons = view.components.flatMap(row => row.components.map(button => button.toJSON() as APIButtonComponentWithCustomId));
	return {
		embeds: view.embeds.map(embed => embed.toJSON()),
		customIds: buttons.map(button => button.custom_id),
		disabled: buttons.map(button => button.disabled ?? false)
	};
}

/**
 * Send the embed through a fake interaction, and return what was displayed and a way to click its buttons
 * @param embed
 */
async function sendEmbed(embed: CrowniclesPaginatedEmbed): Promise<{
	firstView: JsonView;
	click: (customId: string) => Promise<JsonView>;
}> {
	let collect: ((interaction: unknown) => Promise<void>) | undefined;
	let firstView: JsonView | undefined;
	const interaction = {
		user: { id: USER_ID },
		editReply: (view: View): Promise<unknown> => {
			firstView = toJson(view);
			return Promise.resolve({
				createMessageComponentCollector: () => ({
					on: (event: string, handler: (interaction: unknown) => Promise<void>): void => {
						if (event === "collect") {
							collect = handler;
						}
					}
				})
			});
		}
	} as unknown as CrowniclesInteraction;
	await embed.send(interaction);

	return {
		firstView: firstView!,
		click: async (customId: string): Promise<JsonView> => {
			let updated: JsonView | undefined;
			await collect!({
				customId,
				user: { id: USER_ID },
				update: (view: View): Promise<void> => {
					updated = toJson(view);
					return Promise.resolve();
				}
			});
			return updated!;
		}
	};
}

const extraPage = {
	title: "Extra title",
	content: "Extra content",
	openButton: {
		label: "Open", emoji: "⚔️"
	},
	backButton: {
		label: "Back", emoji: "⬅️"
	}
};

describe("CrowniclesPaginatedEmbed extra page", () => {
	it("shows the button opening the extra page next to the navigation, and comes back to the same page", async () => {
		const { firstView, click } = await sendEmbed(new CrowniclesPaginatedEmbed({
			lng: "fr",
			pages: ["page 1", "page 2"],
			selectedPageIndex: 1,
			extraPage
		}));

		expect(firstView.customIds).toEqual(["previous", "next", "openExtraPage"]);
		expect(firstView.embeds[0].description).toBe("page 2");
		expect(firstView.embeds[0].title).toBeUndefined();

		const extraView = await click("openExtraPage");
		expect(extraView.embeds[0]).toMatchObject({
			title: "Extra title",
			description: "Extra content"
		});
		expect(extraView.embeds[0].footer).toBeUndefined();
		expect(extraView.customIds).toEqual(["back"]);

		const backView = await click("back");
		expect(backView.embeds[0].description).toBe("page 2");
		expect(backView.embeds[0].title).toBeUndefined();
		expect(backView.embeds[0].footer).toBeDefined();
		expect(backView.customIds).toEqual(["previous", "next", "openExtraPage"]);
	});

	it("shows the button opening the extra page even when there is a single page", async () => {
		const { firstView } = await sendEmbed(new CrowniclesPaginatedEmbed({
			lng: "fr",
			pages: ["page 1"],
			extraPage
		}));

		expect(firstView.customIds).toEqual(["openExtraPage"]);
	});

	it("keeps the navigation unchanged without extra page", async () => {
		const { firstView: singlePageView } = await sendEmbed(new CrowniclesPaginatedEmbed({
			lng: "fr",
			pages: ["page 1"]
		}));
		expect(singlePageView.customIds).toEqual([]);

		const { firstView, click } = await sendEmbed(new CrowniclesPaginatedEmbed({
			lng: "fr",
			pages: ["page 1", "page 2"]
		}));
		expect(firstView.customIds).toEqual(["previous", "next"]);
		const nextView = await click("next");
		expect(nextView.embeds[0].description).toBe("page 2");
		expect(nextView.customIds).toEqual(["previous", "next"]);
		expect(nextView.disabled).toEqual([false, true]);
	});
});
