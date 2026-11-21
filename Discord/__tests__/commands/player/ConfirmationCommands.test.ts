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
import "../../../src/packetHandlers/handlers/commands/player/UnlockCommandPacketHandlers";
import "../../../src/packetHandlers/handlers/commands/player/JoinBoatCommandPacketHandlers";
import "../../../src/packetHandlers/handlers/commands/player/LeagueRewardCommandPacketHandlers";
import { PacketUtils } from "../../../src/utils/PacketUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorReactPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorUnlock } from "../../../../Lib/src/packets/interaction/ReactionCollectorUnlock";
import { ReactionCollectorJoinBoat } from "../../../../Lib/src/packets/interaction/ReactionCollectorJoinBoat";
import {
	CommandUnlockAcceptPacketRes, CommandUnlockNotEnoughMoney, CommandUnlockRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandUnlockPacket";
import {
	CommandJoinBoatAcceptPacketRes,
	CommandJoinBoatNoMemberOnBoatPacketRes,
	CommandJoinBoatNotEnoughEnergyPacketRes,
	CommandJoinBoatNotTravellingPacketRes,
	CommandJoinBoatRefusePacketRes,
	CommandJoinBoatTooManyRunsPacketRes
} from "../../../../Lib/src/packets/commands/CommandJoinBoatPacket";
import {
	CommandLeagueRewardNotSundayPacketRes, CommandLeagueRewardSuccessPacketRes
} from "../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import { UnlockConstants } from "../../../../Lib/src/constants/UnlockConstants";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import {
	clickOn, collectorPacket, componentsOf, dispatch, embedsOf, ERROR_COLOR, FakeClick, fakeClick, fakeCommand,
	FakeInteraction, fakeUser, lastMessage, sentPackets, setupRendering, singleMessage
} from "../../mocks/DiscordRenderHarness";
import { knownPlayers } from "../../mocks/DiscordRenderMocks";

beforeAll(() => {
	setupRendering();
	knownPlayers.set("prisoner-keycloak-id", "Prisoner");
});

beforeEach(() => {
	vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
});

/**
 * Click on a button of the accept/refuse collector and answer the reaction Core receives with the given packet
 */
async function answerClick(interaction: FakeInteraction, customId: string, answer: (reactionIndex: number) => CrowniclesPacket): Promise<FakeClick> {
	const click = fakeClick(interaction.user, customId);
	await clickOn(interaction.collectors[0], click);
	const [reaction] = sentPackets(ReactionCollectorReactPacket);
	expect(reaction.context.discord?.buttonInteraction).toBe(click.id);
	await dispatch(reaction.context, answer(reaction.packet.reactionIndex));
	return click;
}

async function openUnlock(): Promise<{
	interaction: FakeInteraction; context: PacketContext;
}> {
	const command = fakeCommand("Saviour");
	await dispatch(command.context, collectorPacket(new ReactionCollectorUnlock("prisoner-keycloak-id")));
	return command;
}

describe("unlock", () => {
	it("asks to confirm the release of the prisoner at the unlock price", async () => {
		const { interaction } = await openUnlock();

		const message = singleMessage(interaction);
		const [embed] = embedsOf(message);
		expect(embed.author?.name).toBe("Libération de Prisoner");
		expect(embed.description).toMatch(/3[\s\u202f]?000/);
		expect(componentsOf(message).map(button => button.custom_id)).toEqual(["accept", "refuse"]);
	});

	it("displays the release in the reply to the accept click", async () => {
		const { interaction } = await openUnlock();

		const click = await answerClick(interaction, "accept", reactionIndex => {
			expect(reactionIndex).toBe(0);
			return makePacket(CommandUnlockAcceptPacketRes, { unlockedKeycloakId: "prisoner-keycloak-id" });
		});

		expect(embedsOf(singleMessage(click))[0].description).toBe("Vous avez libéré **Prisoner** !");
	});

	it("displays the cancellation in the reply to the refuse click", async () => {
		const { interaction } = await openUnlock();

		const click = await answerClick(interaction, "refuse", reactionIndex => {
			expect(reactionIndex).toBe(1);
			return makePacket(CommandUnlockRefusePacketRes, {});
		});

		const [embed] = embedsOf(singleMessage(click));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toBe("La libération a été annulée.");
	});

	it("refuses the clicks of another player without telling Core", async () => {
		const { interaction } = await openUnlock();
		const intruder = fakeClick(fakeUser("Intruder"), "accept");

		await clickOn(interaction.collectors[0], intruder);

		expect(embedsOf(singleMessage(intruder))[0].color).toBe(ERROR_COLOR);
		expect(sentPackets(ReactionCollectorReactPacket)).toEqual([]);
	});

	it("disables the buttons once the collector ends", async () => {
		const { interaction } = await openUnlock();

		interaction.collectors[0].stop();
		await new Promise(resolveEnd => setTimeout(resolveEnd, 0));

		expect(componentsOf(lastMessage(interaction)).every(button => button.disabled)).toBe(true);
	});

	it("tells how much money is missing to pay the release", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandUnlockNotEnoughMoney, { money: 1000 }));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toMatch(new RegExp(`${UnlockConstants.PRICE_FOR_UNLOCK - 1000}`.replace(/(\d)(\d{3})$/, "$1[\\s\\u202f]?$2")));
	});
});

describe("join boat", () => {
	it.each([
		[PVEConstants.TRAVEL_COST[0], "est gratuit"],
		[PVEConstants.TRAVEL_COST[1], `coûtera ${PVEConstants.TRAVEL_COST[1]}`]
	])("announces the price of a trip costing %i gems", async (price, expected) => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, collectorPacket(new ReactionCollectorJoinBoat(price, 40, 100)));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.description).toContain(expected);
		expect(embed.description).toContain("40/100");
	});

	it.each([
		[120, true],
		[0, false]
	])("shows the score won by joining the boat (%i points) only when there is some", async (score, shown) => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, collectorPacket(new ReactionCollectorJoinBoat(0, 40, 100)));

		const click = await answerClick(interaction, "accept", () => makePacket(CommandJoinBoatAcceptPacketRes, { score }));

		const [embed] = embedsOf(singleMessage(click));
		expect(embed.description).toContain("Vous rejoignez votre guilde sur le bateau.");
		expect(embed.description?.includes("Points gagnés")).toBe(shown);
	});

	it("displays the refusal to join the boat", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, collectorPacket(new ReactionCollectorJoinBoat(0, 40, 100)));

		const click = await answerClick(interaction, "refuse", () => makePacket(CommandJoinBoatRefusePacketRes, {}));

		const [embed] = embedsOf(singleMessage(click));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain("rester ici");
	});

	it.each([
		[CommandJoinBoatTooManyRunsPacketRes, "trop de fois"],
		[CommandJoinBoatNoMemberOnBoatPacketRes, "Aucun membre actif"],
		[CommandJoinBoatNotTravellingPacketRes, "depuis une ville"],
		[CommandJoinBoatNotEnoughEnergyPacketRes, "pas assez d'énergie"]
	])("explains privately why %o prevents joining the boat", async (packetClass, explanation) => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(packetClass, {}));

		const message = singleMessage(interaction);
		expect(message.payload).toMatchObject({ ephemeral: true });
		expect(embedsOf(message)[0].description).toContain(explanation);
	});
});

describe("league reward", () => {
	const reward = {
		score: 500,
		money: 1200,
		xp: 300,
		gloryPoints: 1800,
		oldLeagueId: 3
	};

	it("congratulates the first of the league with its badge", async () => {
		const {
			interaction, context
		} = fakeCommand("Champion");
		await dispatch(context, makePacket(CommandLeagueRewardSuccessPacketRes, {
			...reward,
			rank: 1
		}));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.author?.name).toContain("Champion");
		expect(embed.description).toContain("1ère place");
		expect(embed.description).toContain("badge");
	});

	it("gives the rank of the other players without badge", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandLeagueRewardSuccessPacketRes, {
			...reward,
			rank: 3
		}));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.description).toContain("3ème place");
		expect(embed.description).not.toContain("badge");
		expect(embed.description).toMatch(/1[\s\u202f]?200/);
	});

	it("tells when the next sunday comes", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandLeagueRewardNotSundayPacketRes, { nextSunday: Date.now() + 2 * 86_400_000 }));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain("dimanche");
	});
});
