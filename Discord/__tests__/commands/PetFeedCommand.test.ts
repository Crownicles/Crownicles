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
import "../../src/packetHandlers/handlers/commands/pet/PetFeedPacketHandlers";
import { PacketUtils } from "../../src/utils/PacketUtils";
import { CommandPetFeedSuccessPacket } from "../../../Lib/src/packets/commands/CommandPetFeedPacket";
import { ReactionCollectorPetFeedWithGuild } from "../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithGuild";
import { ReactionCollectorPetFeedWithoutGuild } from "../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithoutGuild";
import { ReactionCollectorReactPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { PetFood } from "../../../Lib/src/types/PetFood";
import { OwnedPet } from "../../../Lib/src/types/OwnedPet";
import { makePacket } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	clickOn, collectorPacket, componentsOf, dispatch, embedsOf, fakeClick, fakeCommand, FakeInteraction, lastMessage, sentPackets,
	setupRendering, singleMessage
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

beforeEach(() => {
	vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
});

const PET: OwnedPet = {
	typeId: 1,
	nickname: "Rex",
	rarity: 2,
	sex: "m",
	loveLevel: 4,
	force: 80,
	feedDelay: 0
};

async function openGuildFeed(): Promise<FakeInteraction> {
	const {
		interaction, context
	} = fakeCommand("Owner");
	await dispatch(context, collectorPacket(new ReactionCollectorPetFeedWithGuild(PET, [
		{
			food: PetFood.CANDY, amount: 3, maxAmount: 25
		},
		{
			food: PetFood.ULTIMATE, amount: 1, maxAmount: 5
		}
	])));
	return interaction;
}

describe("pet feed with guild", () => {
	it("lists the guild foods with their stock and one button each", async () => {
		const interaction = await openGuildFeed();

		const message = singleMessage(interaction);
		const lines = embedsOf(message)[0].description?.split("\n").filter(line => line.startsWith("- ")) ?? [];
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("(3 / 25)");
		expect(lines[1]).toContain("(1 / 5)");
		expect(componentsOf(message).map(button => button.custom_id)).toEqual(["0", "1", "refuse"]);
	});

	it.each([
		["1", 1],
		["refuse", 2]
	])("sends the reaction of the button %s", async (customId, reactionIndex) => {
		const interaction = await openGuildFeed();

		await clickOn(interaction.collectors[0], fakeClick(interaction.user, customId));

		expect(sentPackets(ReactionCollectorReactPacket)[0].packet.reactionIndex).toBe(reactionIndex);
	});

	it("disables every button once the collector ends", async () => {
		const interaction = await openGuildFeed();

		interaction.collectors[0].stop();
		await new Promise(resolveEnd => setTimeout(resolveEnd, 0));

		expect(componentsOf(lastMessage(interaction)).every(button => button.disabled)).toBe(true);
	});
});

describe("pet feed without guild", () => {
	it("offers to buy the food at its price", async () => {
		const {
			interaction, context
		} = fakeCommand("Owner");
		await dispatch(context, collectorPacket(new ReactionCollectorPetFeedWithoutGuild(PET, PetFood.MEAT, 80)));

		const message = singleMessage(interaction);
		expect(embedsOf(message)[0].description).toContain("80");
		expect(componentsOf(message).map(button => button.custom_id)).toEqual(["accept", "refuse"]);
	});
});

describe("pet feed result", () => {
	it.each([
		["happy", "semble heureux"],
		["dislike", "pas avoir aimé"]
	])("displays how the pet liked its meal (%s) in the reply to the click", async (result, expected) => {
		const interaction = await openGuildFeed();
		const click = fakeClick(interaction.user, "0");
		await clickOn(interaction.collectors[0], click);
		const [reaction] = sentPackets(ReactionCollectorReactPacket);

		await dispatch(reaction.context, makePacket(CommandPetFeedSuccessPacket, { result } as CommandPetFeedSuccessPacket));

		expect(embedsOf(singleMessage(click))[0].description).toContain(expected);
	});
});
