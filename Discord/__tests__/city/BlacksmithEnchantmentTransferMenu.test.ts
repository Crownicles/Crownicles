import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { Message, MessageComponentInteraction } from "discord.js";

vi.mock("../../src/utils/DiscordCollectorUtils", () => ({
	DiscordCollectorUtils: {
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
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import {
	ReactionCollectorBlacksmithEnchantmentTransferReaction,
	ReactionCollectorBlacksmithMenuReaction,
	ReactionCollectorCityData
} from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { EnchantmentTransferSource } from "../../../Lib/src/types/EnchantmentTransfer";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import {
	BlacksmithMenuParams, getBlacksmithMenus
} from "../../src/commands/player/report/blacksmith/BlacksmithMenu";
import { BlacksmithMenuIds } from "../../src/commands/player/report/blacksmith/BlacksmithMenuConstants";
import { CrowniclesNestedMenu } from "../../src/messages/CrowniclesNestedMenus";

const TRANSFER_MENU = BlacksmithMenuIds.ENCHANTMENT_TRANSFER_MENU;
const AFFORDABLE_COST = 400;
const UNAFFORDABLE_COST = 6000;

function itemDetails(id: number): MainItemDetails {
	return { id } as MainItemDetails;
}

function createSource(slot: number, enchantment: ItemEnchantment, target: {
	slot: number; cost: number; canAfford: boolean;
}): EnchantmentTransferSource {
	return {
		slot,
		category: ItemCategory.WEAPON,
		details: itemDetails(100 + slot),
		enchantmentId: enchantment.id,
		enchantmentType: enchantment.kind.type.id,
		targets: [{
			...target,
			details: itemDetails(200 + target.slot)
		}]
	};
}

const enchantmentTransfers = [
	createSource(0, ItemEnchantment.PVE_ATTACK_1, {
		slot: 1, cost: AFFORDABLE_COST, canAfford: true
	}),
	createSource(2, ItemEnchantment.ALL_ATTACK_1, {
		slot: 3, cost: UNAFFORDABLE_COST, canAfford: false
	})
];

function createPacket(): ReactionCollectorCreationPacket {
	return {
		id: "city-collector-id",
		reactions: [
			{
				type: ReactionCollectorBlacksmithMenuReaction.name, data: {}
			},
			...enchantmentTransfers.map(source => ({
				type: ReactionCollectorBlacksmithEnchantmentTransferReaction.name,
				data: {
					itemCategory: source.category,
					sourceSlot: source.slot,
					targetSlot: source.targets[0].slot
				}
			}))
		],
		data: {
			data: {
				blacksmith: {
					upgradeableItems: [],
					enchantmentTransfers,
					playerMoney: 1000
				}
			} as unknown as ReactionCollectorCityData
		}
	} as unknown as ReactionCollectorCreationPacket;
}

function createMenuParams(packet: ReactionCollectorCreationPacket): BlacksmithMenuParams {
	return {
		context: {
			keycloakId: "keycloak-id",
			discord: { interaction: "interaction-id" }
		} as never,
		interaction: {
			user: { id: "discord-user-id" },
			userLanguage: LANGUAGE.FRENCH
		} as never,
		packet,
		collectorTime: 1000,
		pseudo: "Player"
	};
}

type RenderedComponent = {
	custom_id?: string;
	disabled?: boolean;
	content?: string;
	components?: RenderedComponent[];
	accessory?: RenderedComponent;
};

function flattenComponents(menu: CrowniclesNestedMenu): RenderedComponent[] {
	const flatten = (component: RenderedComponent): RenderedComponent[] => [
		component,
		...(component.components ?? []).flatMap(flatten),
		...(component.accessory ? flatten(component.accessory) : [])
	];
	return menu.containers!.flatMap(container => flatten(container.toJSON() as RenderedComponent));
}

function renderedText(menu: CrowniclesNestedMenu): string {
	return flattenComponents(menu).map(component => component.content ?? "").join("\n");
}

function findButton(menu: CrowniclesNestedMenu, customId: string): RenderedComponent | undefined {
	return flattenComponents(menu).find(component => component.custom_id === customId);
}

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

describe("blacksmith enchantment transfer menus", () => {
	let menus: Map<string, CrowniclesNestedMenu>;
	let packet: ReactionCollectorCreationPacket;

	beforeEach(() => {
		vi.clearAllMocks();
		packet = createPacket();
		menus = getBlacksmithMenus(createMenuParams(packet));
	});

	it("registers a target page per source and a confirmation page per source and target", () => {
		expect([...menus.keys()]).toEqual([
			BlacksmithMenuIds.BLACKSMITH_MENU,
			TRANSFER_MENU,
			`${TRANSFER_MENU}_SOURCE_0`,
			`${TRANSFER_MENU}_SOURCE_0_TARGET_0`,
			`${TRANSFER_MENU}_SOURCE_1`,
			`${TRANSFER_MENU}_SOURCE_1_TARGET_0`
		]);
		expect(findButton(menus.get(BlacksmithMenuIds.BLACKSMITH_MENU)!, TRANSFER_MENU)).toBeDefined();
	});

	it("shows the moved enchantment, both equipments and the price before confirming", () => {
		const confirmMenu = menus.get(`${TRANSFER_MENU}_SOURCE_0_TARGET_0`)!;
		const text = renderedText(confirmMenu);

		expect(text).toContain("item-100");
		expect(text).toContain("item-201");
		expect(text).toContain("400");
		expect(text).not.toContain("commands:report");
		expect(text).not.toContain("items:enchantments");
	});

	it("disables the confirmation when the player cannot afford the transfer", () => {
		expect(findButton(menus.get(`${TRANSFER_MENU}_SOURCE_0_TARGET_0`)!, BlacksmithMenuIds.CONFIRM_ENCHANTMENT_TRANSFER)?.disabled).toBe(false);
		expect(findButton(menus.get(`${TRANSFER_MENU}_SOURCE_1_TARGET_0`)!, BlacksmithMenuIds.CONFIRM_ENCHANTMENT_TRANSFER)?.disabled).toBe(true);
	});

	it("sends the reaction of the confirmed source and target", async () => {
		const { interaction } = await clickButton(menus.get(`${TRANSFER_MENU}_SOURCE_1_TARGET_0`)!, BlacksmithMenuIds.CONFIRM_ENCHANTMENT_TRANSFER);

		expect(interaction.deferReply).toHaveBeenCalledOnce();
		expect(DiscordCollectorUtils.sendReaction).toHaveBeenCalledWith(
			packet,
			expect.objectContaining({ keycloakId: "keycloak-id" }),
			"keycloak-id",
			interaction,
			2
		);
	});

	it("navigates only to the pages offered by the current page", async () => {
		const sourcesMenu = menus.get(TRANSFER_MENU)!;

		expect((await clickButton(sourcesMenu, `${TRANSFER_MENU}_SOURCE_1`)).changeMenu).toHaveBeenCalledWith(`${TRANSFER_MENU}_SOURCE_1`);
		expect((await clickButton(sourcesMenu, `${TRANSFER_MENU}_SOURCE_1_TARGET_0`)).changeMenu).not.toHaveBeenCalled();
		expect(DiscordCollectorUtils.sendReaction).not.toHaveBeenCalled();
	});
});
