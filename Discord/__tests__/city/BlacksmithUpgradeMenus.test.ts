import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { Message, MessageComponentInteraction } from "discord.js";

vi.mock("../../src/utils/DiscordCollectorUtils", async () => ({
	DiscordCollectorUtils: {
		...(await import("../mocks/DiscordCollectorUtilsMock")).collectorAcknowledgementMocks,
		sendReaction: vi.fn()
	},
	disableRows: vi.fn()
}));

vi.mock("../../src/utils/DisplayUtils", async importOriginal => {
	const original = await importOriginal<typeof import("../../src/utils/DisplayUtils")>();
	return {
		...original,
		DisplayUtils: {
			...original.DisplayUtils,
			getItemDisplayWithStatsWithoutMaxValues: (details: { id: number }): string => `item-${details.id}`
		}
	};
});

import { LANGUAGE } from "../../../Lib/src/Language";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import {
	ReactionCollectorBlacksmithUpgradeReaction,
	ReactionCollectorCityData,
	ReactionCollectorRoyalBlacksmithUpgradeReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { getBlacksmithMenus } from "../../src/commands/player/report/blacksmith/BlacksmithMenu";
import { BlacksmithMenuIds } from "../../src/commands/player/report/blacksmith/BlacksmithMenuConstants";
import { getRoyalBlacksmithMenus } from "../../src/commands/player/report/royalBlacksmith/RoyalBlacksmithMenu";
import { RoyalBlacksmithMenuIds } from "../../src/commands/player/report/royalBlacksmith/RoyalBlacksmithMenuConstants";
import { CityMenuParams } from "../../src/commands/player/report/ReportCityMenuTypes";
import { CrowniclesNestedMenu } from "../../src/messages/CrowniclesNestedMenus";

function createOffer(slot: number, category: ItemCategory): Record<string, unknown> {
	return {
		slot,
		category,
		details: { id: slot } as MainItemDetails,
		nextLevel: 2,
		upgradeCost: 100,
		gemCost: 10,
		itemRarity: 5,
		requiredMaterials: [],
		missingMaterialsCost: 50,
		hasAllMaterials: false,
		canUpgrade: true,
		canBuyAndUpgrade: true
	};
}

const offers = [createOffer(0, ItemCategory.WEAPON), createOffer(1, ItemCategory.ARMOR)];

function upgradeReaction(type: string, slot: number, itemCategory: ItemCategory, buyMaterials: boolean): ReactionCollectorCreationPacket["reactions"][number] {
	return {
		type,
		data: {
			slot, itemCategory, buyMaterials
		}
	};
}

const blacksmiths = [
	{
		name: "blacksmith",
		ids: BlacksmithMenuIds,
		reactionType: ReactionCollectorBlacksmithUpgradeReaction.name,
		otherReactionType: ReactionCollectorRoyalBlacksmithUpgradeReaction.name,
		data: {
			blacksmith: {
				upgradeableItems: offers, enchantmentTransfers: [], playerMoney: 1000
			}
		},
		getMenus: getBlacksmithMenus
	},
	{
		name: "royal blacksmith",
		ids: RoyalBlacksmithMenuIds,
		reactionType: ReactionCollectorRoyalBlacksmithUpgradeReaction.name,
		otherReactionType: ReactionCollectorBlacksmithUpgradeReaction.name,
		data: {
			royalBlacksmith: {
				status: "ready", playerLevel: 100, upgradeableItems: offers, playerMoney: 1000, playerGems: 100
			}
		},
		getMenus: getRoyalBlacksmithMenus
	}
];

async function clickButton(menu: CrowniclesNestedMenu, customId: string): Promise<{
	changeMenu: ReturnType<typeof vi.fn>;
	interaction: MessageComponentInteraction;
}> {
	let collectHandler: ((interaction: MessageComponentInteraction) => Promise<void>) | undefined;
	const collector = {
		on: vi.fn((event: string, handler: (interaction: MessageComponentInteraction) => Promise<void>) => {
			if (event === "collect") {
				collectHandler = handler;
			}
			return collector;
		})
	};
	const message = { createMessageComponentCollector: vi.fn(() => collector) } as unknown as Message;
	const nestedMenus = { changeMenu: vi.fn() };
	menu.createCollector!(nestedMenus as never, message);
	const interaction = {
		customId,
		user: { id: "discord-user-id" },
		deferUpdate: vi.fn().mockResolvedValue(undefined),
		deferReply: vi.fn().mockResolvedValue(undefined),
		deleteReply: vi.fn().mockResolvedValue(undefined)
	} as unknown as MessageComponentInteraction;
	await collectHandler!(interaction);
	return {
		changeMenu: nestedMenus.changeMenu, interaction
	};
}

describe.each(blacksmiths)("$name upgrade menus", blacksmith => {
	const {
		ids, reactionType, otherReactionType
	} = blacksmith;
	let packet: ReactionCollectorCreationPacket;
	let menus: Map<string, CrowniclesNestedMenu>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(CrowniclesLogger, "error").mockImplementation(() => undefined);
		packet = {
			id: "city-collector-id",
			reactions: [
				upgradeReaction(otherReactionType, 1, ItemCategory.ARMOR, true),
				upgradeReaction(reactionType, 1, ItemCategory.ARMOR, false),
				upgradeReaction(reactionType, 1, ItemCategory.ARMOR, true),
				upgradeReaction(reactionType, 0, ItemCategory.WEAPON, false)
			],
			data: { data: blacksmith.data as unknown as ReactionCollectorCityData }
		} as unknown as ReactionCollectorCreationPacket;
		const params: CityMenuParams = {
			context: { keycloakId: "keycloak-id" } as never,
			interaction: {
				user: { id: "discord-user-id" },
				userLanguage: LANGUAGE.FRENCH
			} as never,
			packet,
			collectorTime: 1000,
			pseudo: "Player"
		};
		menus = blacksmith.getMenus(params);
	});

	it("opens the upgrade detail of the selected item", async () => {
		const { changeMenu } = await clickButton(menus.get(ids.UPGRADE_MENU)!, `${ids.UPGRADE_ITEM_PREFIX}1`);

		expect(changeMenu).toHaveBeenCalledWith(`${ids.UPGRADE_MENU}_DETAIL_1`);
	});

	it.each([
		{
			button: ids.CONFIRM_UPGRADE, reactionIndex: 1
		},
		{
			button: ids.BUY_AND_UPGRADE, reactionIndex: 2
		}
	])("sends the upgrade reaction of the item matching $button", async ({
		button, reactionIndex
	}) => {
		const { interaction } = await clickButton(menus.get(`${ids.UPGRADE_MENU}_DETAIL_1`)!, button);

		expect(interaction.deferReply).toHaveBeenCalledOnce();
		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledWith(packet, expect.anything(), "keycloak-id", interaction, reactionIndex);
	});

	it("withdraws its reply when the Core did not offer the upgrade", async () => {
		const { interaction } = await clickButton(menus.get(`${ids.UPGRADE_MENU}_DETAIL_0`)!, ids.BUY_AND_UPGRADE);

		expect(interaction.deleteReply).toHaveBeenCalledOnce();
		expect(DiscordCollectorUtils.sendReaction).not.toHaveBeenCalled();
	});

	it("leaves unanswered a click on a button the detail menu does not offer", async () => {
		const { interaction } = await clickButton(menus.get(`${ids.UPGRADE_MENU}_DETAIL_1`)!, `${ids.UPGRADE_ITEM_PREFIX}0`);

		expect(interaction.deferUpdate).not.toHaveBeenCalled();
		expect(interaction.deferReply).not.toHaveBeenCalled();
	});
});
