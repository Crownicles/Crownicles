import {
	beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", async () => (await import("../../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../../src/packetHandlers/handlers/ReactionCollectorHandlers";
import { PacketUtils } from "../../../src/utils/PacketUtils";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandEquipActionReq, CommandEquipActionRes, EquipCategoryData
} from "../../../../Lib/src/packets/commands/CommandEquipPacket";
import { ReactionCollectorEquip } from "../../../../Lib/src/packets/interaction/ReactionCollectorEquip";
import { ReactionCollectorReactPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ItemCategory, ItemConstants, ItemNature
} from "../../../../Lib/src/constants/ItemConstants";
import {
	clickOn, collectorPacket, componentsOf, dispatch, embedsOf, ERROR_COLOR, fakeClick, FakeCommand, fakeCommand, fakeUser,
	lastMessage, latestCollector, mainItem, sentPackets, setupRendering, singleMessage, supportItem
} from "../../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

beforeEach(() => {
	vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
});

function categories(weapon: Partial<EquipCategoryData> = {}): EquipCategoryData[] {
	return [
		{
			category: ItemCategory.WEAPON,
			equippedItem: { details: mainItem(ItemCategory.WEAPON, 1, { attack: 30 }) },
			reserveItems: [
				{
					slot: 1,
					details: mainItem(ItemCategory.WEAPON, 2, { attack: 40 })
				},
				{
					slot: 2,
					details: mainItem(ItemCategory.WEAPON, 3, { attack: 50 })
				}
			],
			maxReserveSlots: 2,
			canDeposit: false,
			...weapon
		},
		{
			category: ItemCategory.ARMOR,
			equippedItem: null,
			reserveItems: [],
			maxReserveSlots: 1,
			canDeposit: true
		},
		{
			category: ItemCategory.POTION,
			equippedItem: { details: supportItem(ItemCategory.POTION, 1, ItemNature.HEALTH, 10) },
			reserveItems: [
				{
					slot: 1,
					details: supportItem(ItemCategory.POTION, 2, ItemNature.HEALTH, 20)
				}
			],
			maxReserveSlots: 1,
			canDeposit: true
		}
	];
}

async function openEquip(equipCategories = categories()): Promise<FakeCommand> {
	const command = fakeCommand("Hero");
	await dispatch(command.context, collectorPacket(new ReactionCollectorEquip(equipCategories)));
	return command;
}

describe("equip menu", () => {
	it("opens on one button per category, labelled with its number of items, and a close button", async () => {
		const { interaction } = await openEquip();

		const buttons = componentsOf(singleMessage(interaction));
		expect(buttons.map(button => button.custom_id)).toEqual(["EQUIP_CAT_0", "EQUIP_CAT_1", "EQUIP_CAT_2", "EQUIP_CLOSE"]);
		expect(buttons[0].label).toMatch(/\(3\)$/);
		expect(buttons[1].label).toMatch(/\(0\)$/);
		expect(buttons[2].label).toMatch(/\(2\)$/);
	});

	it("lists the equipped and reserve items of a category, the deposit being disabled when the reserve is full", async () => {
		const { interaction } = await openEquip();

		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "EQUIP_CAT_0"));

		const view = lastMessage(interaction);
		expect(view.method).toBe("message.edit");
		const [embed] = embedsOf(view);
		expect(embed.description).toContain("Réserve pleine");
		expect(embed.description).toContain("Réserve (2/2)");
		const buttons = componentsOf(view);
		expect(buttons.map(button => button.custom_id)).toEqual(["EQUIP_DEPOSIT_0", "EQUIP_ITEM_0_1", "EQUIP_ITEM_0_2", "EQUIP_BACK_CATS"]);
		expect(buttons[0].disabled).toBe(true);
		expect(buttons[1].disabled).toBeFalsy();
	});

	it("tells that a category has neither equipped nor reserve item", async () => {
		const { interaction } = await openEquip();

		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "EQUIP_CAT_1"));

		const view = lastMessage(interaction);
		expect(embedsOf(view)[0].description).toContain("Aucun objet équipé");
		expect(embedsOf(view)[0].description).toContain("Aucun objet en réserve");
		expect(componentsOf(view).map(button => button.custom_id)).toEqual(["EQUIP_BACK_CATS"]);
	});

	it("offers a single swap button when one item is equipped and one is in reserve", async () => {
		const { interaction } = await openEquip();

		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "EQUIP_CAT_2"));

		const view = lastMessage(interaction);
		expect(embedsOf(view)[0].description).toContain("Échanger");
		expect(componentsOf(view).map(button => button.custom_id)).toEqual(["EQUIP_ITEM_2_1", "EQUIP_BACK_CATS"]);
	});

	it("asks Core to equip the chosen reserve item and refreshes the category with Core's answer", async () => {
		const { interaction } = await openEquip();
		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "EQUIP_CAT_0"));

		await clickOn(latestCollector(interaction), fakeClick(interaction.user, "EQUIP_ITEM_0_2"));

		const [request] = sentPackets(CommandEquipActionReq);
		expect(request.packet).toMatchObject({
			action: ItemConstants.EQUIP_ACTIONS.EQUIP,
			itemCategory: ItemCategory.WEAPON,
			slot: 2
		});

		await dispatch(request.context, makePacket(CommandEquipActionRes, {
			success: true,
			categories: categories({
				reserveItems: [],
				canDeposit: true
			})
		}));

		const view = lastMessage(interaction);
		expect(embedsOf(view)[0].description).toContain("Réserve (0/2)");
		expect(componentsOf(view)[0]).toMatchObject({
			custom_id: "EQUIP_DEPOSIT_0"
		});
		expect(componentsOf(view)[0].disabled).toBeFalsy();
	});

	it("asks Core to deposit the equipped item", async () => {
		const { interaction } = await openEquip(categories({ canDeposit: true }));
		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "EQUIP_CAT_0"));

		await clickOn(latestCollector(interaction), fakeClick(interaction.user, "EQUIP_DEPOSIT_0"));

		expect(sentPackets(CommandEquipActionReq)[0].packet).toMatchObject({
			action: ItemConstants.EQUIP_ACTIONS.DEPOSIT,
			itemCategory: ItemCategory.WEAPON
		});
	});

	it("goes back to the categories", async () => {
		const { interaction } = await openEquip();
		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "EQUIP_CAT_0"));

		await clickOn(latestCollector(interaction), fakeClick(interaction.user, "EQUIP_BACK_CATS"));

		expect(componentsOf(lastMessage(interaction)).at(-1)?.custom_id).toBe("EQUIP_CLOSE");
	});

	it("sends the close reaction to Core", async () => {
		const {
			interaction, context
		} = await openEquip();

		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "EQUIP_CLOSE"));

		const [reaction] = sentPackets(ReactionCollectorReactPacket);
		expect(reaction.context.discord?.interaction).toBe(context.discord?.interaction);
		expect(reaction.packet.reactionIndex).toBe(0);
	});

	it("refuses the clicks of another player", async () => {
		const { interaction } = await openEquip();
		const intruder = fakeClick(fakeUser("Intruder"), "EQUIP_CAT_0");

		await clickOn(interaction.collectors[0], intruder);

		expect(embedsOf(lastMessage(intruder))[0].color).toBe(ERROR_COLOR);
		expect(interaction.messages).toHaveLength(1);
	});

	it("tells that the menu is closed once Core ends the collector", async () => {
		const { interaction } = await openEquip();

		interaction.collectors[1].stop();
		await new Promise(resolveEnd => setTimeout(resolveEnd, 0));

		const closing = lastMessage(interaction);
		expect(closing.method).toBe("followUp");
		expect(embedsOf(closing)[0].description).toBe("Vous avez fermé le menu d'équipement.");
	});
});
