import {
	beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../src/packetHandlers/handlers/ReactionCollectorHandlers";
import "../../src/packetHandlers/handlers/commands/pet/PetFreeCommandPacketHandlers";
import { PacketUtils } from "../../src/utils/PacketUtils";
import {
	CommandPetFreeAcceptPacketRes,
	CommandPetFreePacketRes,
	CommandPetFreeRefusePacketRes,
	CommandPetFreeShelterCooldownErrorPacketRes,
	CommandPetFreeShelterMissingMoneyErrorPacketRes,
	CommandPetFreeShelterSuccessPacketRes
} from "../../../Lib/src/packets/commands/CommandPetFreePacket";
import {
	ReactionCollectorPetFree,
	ReactionCollectorPetFreeSelectReaction,
	ReactionCollectorPetFreeSelection
} from "../../../Lib/src/packets/interaction/ReactionCollectorPetFree";
import {
	ReactionCollectorReactPacket, ReactionCollectorRefuseReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { PetFreeConstants } from "../../../Lib/src/constants/PetFreeConstants";
import { OwnedPet } from "../../../Lib/src/types/OwnedPet";
import {
	CrowniclesPacket, makePacket
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	answeredClick, clickOn, collectorPacket, componentsOf, dispatch, embedsOf, ERROR_COLOR, FakeClick, fakeClick, FakeCommand, fakeCommand,
	FakeInteraction, lastMessage, RenderedEmbed, sentPackets, setupRendering, singleMessage
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

beforeEach(() => {
	vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
});

async function renderAnswer(packet: CrowniclesPacket): Promise<RenderedEmbed> {
	const command = fakeCommand("Owner");
	const {
		click, context
	} = answeredClick(command);
	await dispatch(context, packet);
	return embedsOf(singleMessage({ messages: [...command.interaction.messages, ...click.messages] }))[0];
}

describe("pet free refusals", () => {
	it.each([
		[{ foundPet: false }, "Aucun familier n'a été trouvé."],
		[{
			foundPet: true, petCanBeFreed: false, missingMoney: 120
		}, "120"],
		[{
			foundPet: true, petCanBeFreed: false, cooldownRemainingTimeMs: 3_600_000
		}, "un familier par heure"],
		[{
			foundPet: true, petCanBeFreed: false, petOnExpedition: true
		}, "en expédition"]
	])("explains why the pet cannot be freed (%o)", async (packet, expected) => {
		const embed = await renderAnswer(makePacket(CommandPetFreePacketRes, packet));

		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain(expected);
	});

	it("leaves the display to the confirmation when the pet can be freed", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandPetFreePacketRes, {
			foundPet: true, petCanBeFreed: true
		}));

		expect(interaction.messages).toEqual([]);
	});

	it.each([
		[makePacket(CommandPetFreeShelterCooldownErrorPacketRes, { cooldownRemainingTimeMs: 3_600_000 }), "un familier par heure"],
		[makePacket(CommandPetFreeShelterMissingMoneyErrorPacketRes, { missingMoney: 300 }), "300"]
	])("explains why the shelter pet cannot be freed (%o)", async (packet, expected) => {
		const embed = await renderAnswer(packet);

		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain(expected);
	});
});

async function openConfirmation(freeCost: number): Promise<FakeCommand> {
	const command = fakeCommand("Owner");
	await dispatch(command.context, collectorPacket(new ReactionCollectorPetFree(1, "m", "Rex", freeCost)));
	return command;
}

async function answerClick(interaction: FakeInteraction, customId: string, answer: CrowniclesPacket): Promise<FakeClick> {
	const click = fakeClick(interaction.user, customId);
	await clickOn(interaction.collectors[0], click);
	const [reaction] = sentPackets(ReactionCollectorReactPacket);
	await dispatch(reaction.context, answer);
	return click;
}

describe("pet free confirmation", () => {
	it("warns of the cost of freeing a feisty pet", async () => {
		const calm = await openConfirmation(0);
		const feisty = await openConfirmation(PetFreeConstants.FREE_FEISTY_COST);

		expect(embedsOf(singleMessage(calm.interaction))[0].footer).toBeUndefined();
		expect(embedsOf(singleMessage(feisty.interaction))[0].footer?.text).toContain("500");
		expect(embedsOf(singleMessage(feisty.interaction))[0].description).toContain("Rex");
	});

	it("bids farewell to the pet in the reply to the accept click", async () => {
		const { interaction } = await openConfirmation(0);

		const click = await answerClick(interaction, "accept", makePacket(CommandPetFreeAcceptPacketRes, {
			petId: 1, petSex: "m", petNickname: "Rex", freeCost: 0, luckyMeat: false
		}));

		expect(embedsOf(singleMessage(click))[0].description).toContain("Adieu **");
	});

	// Bug: Core credits the guild with a piece of meat when an own pet leaves (luckyMeat), but handleCommandPetFreeAcceptPacketRes never tells it, unlike the shelter flow. The feisty cost is shown on the confirmation, before the click
	it.fails("tells the player about the meat his freed pet left to the guild", async () => {
		const { interaction } = await openConfirmation(0);

		const click = await answerClick(interaction, "accept", makePacket(CommandPetFreeAcceptPacketRes, {
			petId: 1, petSex: "m", petNickname: "Rex", freeCost: 0, luckyMeat: true
		}));

		expect(embedsOf(singleMessage(click))[0].description).toContain("morceau de viande");
	});

	it("displays the cancellation in the reply to the refuse click", async () => {
		const { interaction } = await openConfirmation(0);

		const click = await answerClick(interaction, "refuse", makePacket(CommandPetFreeRefusePacketRes, {}));

		const [embed] = embedsOf(singleMessage(click));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toBe("Le familier n'a pas été libéré.");
	});
});

const SHELTER_PET: OwnedPet = {
	typeId: 2,
	nickname: "",
	rarity: 1,
	sex: "f",
	loveLevel: 2,
	force: 10,
	feedDelay: 0
};

const OWN_PET: OwnedPet = {
	...SHELTER_PET,
	typeId: 1,
	nickname: "Rex",
	sex: "m"
};

function selectReaction(petEntityId: number): ReactionCollectorPetFreeSelectReaction {
	return Object.assign(new ReactionCollectorPetFreeSelectReaction(), { petEntityId });
}

async function openSelection(): Promise<FakeInteraction> {
	const {
		interaction, context
	} = fakeCommand("Owner");
	await dispatch(context, collectorPacket(new ReactionCollectorPetFreeSelection(
		OWN_PET,
		[
			{
				petEntityId: 42, pet: SHELTER_PET
			}
		],
		[selectReaction(7), selectReaction(42), new ReactionCollectorRefuseReaction()]
	)));
	return interaction;
}

describe("pet free selection", () => {
	it("offers the own pet and the shelter pets, with a cancel button", async () => {
		const interaction = await openSelection();

		const [menu, cancel] = componentsOf(singleMessage(interaction));
		expect(menu.options?.map(option => option.value)).toEqual(["0", "1"]);
		expect(menu.options?.[0].label).toBe("Rex");
		expect(menu.options?.[0].description).toBe("Votre familier personnel");
		expect(cancel.custom_id).toBe("cancel");
	});

	it("sends the selected pet and disables the menu", async () => {
		const interaction = await openSelection();

		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "selectPet", ["1"]));

		expect(sentPackets(ReactionCollectorReactPacket)[0].packet.reactionIndex).toBe(1);
		expect(componentsOf(lastMessage(interaction)).every(component => component.disabled)).toBe(true);
	});

	it("sends the refusal when the player cancels", async () => {
		const interaction = await openSelection();

		await clickOn(interaction.collectors[0], fakeClick(interaction.user, "cancel"));

		expect(sentPackets(ReactionCollectorReactPacket)[0].packet.reactionIndex).toBe(2);
	});

	it.each([
		[{
			freeCost: 0, luckyMeat: false
		}, []],
		[{
			freeCost: 500, luckyMeat: true
		}, ["500", "morceau de viande"]]
	])("bids farewell to the shelter pet with its cost and gift (%o)", async (outcome, expected) => {
		const embed = await renderAnswer(makePacket(CommandPetFreeShelterSuccessPacketRes, {
			petId: 2, petSex: "f", ...outcome
		}));

		expect(embed.description).toContain("Adieu **");
		expect(embed.description?.split("\n")).toHaveLength(1 + expected.length);
		for (const text of expected) {
			expect(embed.description).toContain(text);
		}
	});
});
