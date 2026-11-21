import {
	beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", async () => (await import("../../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../../src/packetHandlers/handlers/commands/player/TopCommandPacketHandlers";
import { commandInfo } from "../../../src/commands/player/TopCommand";
import { PacketUtils } from "../../../src/utils/PacketUtils";
import {
	CommandTopGuildsEmptyPacket,
	CommandTopPacketReq,
	CommandTopPacketResGlory,
	CommandTopPacketResGuild,
	CommandTopPacketResScore,
	CommandTopPlayersEmptyPacket
} from "../../../../Lib/src/packets/commands/CommandTopPacket";
import {
	TopElementGlory, TopElementGuild, TopElementScore
} from "../../../../Lib/src/types/TopElement";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	clickOn, componentsOf, dispatch, embedsOf, ERROR_COLOR, fakeClick, fakeCommand, lastMessage, RenderedMessage, sentPackets,
	setupRendering, singleMessage
} from "../../mocks/DiscordRenderHarness";
import { knownPlayers } from "../../mocks/DiscordRenderMocks";
import { TopDataType } from "../../../../Lib/src/types/TopDataType";
import { TopTiming } from "../../../../Lib/src/types/TopTimings";

describe("top command packet", () => {
	it("reads the duration option for weekly score rankings", async () => {
		const deferReply = vi.fn().mockResolvedValue(undefined);
		const getString = vi.fn().mockReturnValue(TopTiming.WEEK);
		const interaction = {
			deferReply,
			options: {
				getSubcommand: vi.fn().mockReturnValue("score"),
				getString,
				getInteger: vi.fn().mockReturnValue(null)
			}
		};

		const packet = await commandInfo.getPacket(interaction as never, {} as never);

		expect(packet).toBeInstanceOf(CommandTopPacketReq);
		expect(packet.dataType).toBe(TopDataType.SCORE);
		expect(packet.timing).toBe(TopTiming.WEEK);
		expect(getString).toHaveBeenCalledWith("duration");
		expect(deferReply).toHaveBeenCalledOnce();
	});

	it("serializes the duration option with its localized name", () => {
		const command = commandInfo.slashCommandBuilder.toJSON();
		const scoreSubcommand = command.options?.find(option => option.name === "score");
		if (!scoreSubcommand || !("options" in scoreSubcommand)) {
			throw new Error("The score subcommand has no options");
		}

		const durationOption = scoreSubcommand.options?.find(option => option.name === "duration");

		expect(durationOption).toMatchObject({
			name: "duration",
			name_localizations: { fr: "duree" }
		});
	});
});
function scoreElement(rank: number, keycloakId: string, sameContext = false): TopElementScore {
	return {
		rank,
		sameContext,
		text: keycloakId,
		attributes: {
			1: { afk: false },
			2: 10_000 - rank,
			3: 50
		}
	};
}

function scoreTop(overrides: Partial<CommandTopPacketResScore> = {}): CommandTopPacketResScore {
	return makePacket(CommandTopPacketResScore, {
		timing: TopTiming.ALL_TIME,
		canBeRanked: true,
		elements: [
			scoreElement(1, "first-keycloak-id"),
			scoreElement(2, "Ranked-keycloak-id", true),
			scoreElement(3, "unknown-keycloak-id")
		],
		contextRank: 2,
		totalElements: 3,
		elementsPerPage: 10,
		pageNumber: 1,
		...overrides
	});
}

function descriptionLines(message: RenderedMessage): string[] {
	return (embedsOf(message)[0].description ?? "").split("\n");
}

describe("top display", () => {
	beforeAll(() => {
		setupRendering();
		knownPlayers.set("first-keycloak-id", "Leader");
	});

	beforeEach(() => {
		vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
	});

	it("names the ranked players, rewards the podium with medals and shows the rank of the player", async () => {
		const {
			interaction, context
		} = fakeCommand("Ranked");
		await dispatch(context, scoreTop());

		const message = singleMessage(interaction);
		expect(embedsOf(message)[0].title).toContain("places 1 à 3");
		const lines = descriptionLines(message);
		expect(lines[0]).toContain("Leader");
		expect(lines[1]).toContain("Ranked");
		expect(lines[2]).toContain("Pseudo 404");
		expect(lines.join("\n")).toContain("classé **2ème** sur un total de 3 joueurs");
		expect(componentsOf(message)).toEqual([]);
	});

	it("congratulates the first of the top", async () => {
		const {
			interaction, context
		} = fakeCommand("Ranked");
		await dispatch(context, scoreTop({ contextRank: 1 }));

		expect(embedsOf(singleMessage(interaction))[0].description).toContain("Félicitations **Ranked**");
	});

	it("explains why a player is not in the glory top", async () => {
		const gloryElement: TopElementGlory = {
			rank: 4,
			sameContext: false,
			text: "first-keycloak-id",
			attributes: {
				1: 2,
				2: 1500,
				3: 80
			}
		};
		const {
			interaction, context
		} = fakeCommand("Newcomer");
		await dispatch(context, makePacket(CommandTopPacketResGlory, {
			timing: TopTiming.ALL_TIME,
			canBeRanked: true,
			elements: [gloryElement],
			totalElements: 1,
			elementsPerPage: 10,
			pageNumber: 1,
			needFight: 3
		}));

		const lines = descriptionLines(singleMessage(interaction));
		expect(lines[0]).toContain(CrowniclesIcons.leagues["2"]);
		expect(lines.at(-1)).toContain("encore réaliser 3 combats classés");
	});

	it("tells a player without guild that he cannot appear in the guild top", async () => {
		const guildElement: TopElementGuild = {
			rank: 1,
			sameContext: false,
			text: "The Guild",
			attributes: {
				1: 900,
				2: 12,
				3: undefined
			}
		};
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandTopPacketResGuild, {
			timing: TopTiming.ALL_TIME,
			canBeRanked: false,
			elements: [guildElement],
			totalElements: 1,
			elementsPerPage: 10,
			pageNumber: 1
		}));

		const lines = descriptionLines(singleMessage(interaction));
		expect(lines[0]).toContain("The Guild");
		expect(lines.at(-1)).toContain("ne faites pas partie d'une guilde");
	});

	it("fetches the next page from Core when the player turns the page", async () => {
		const {
			interaction, context
		} = fakeCommand("Ranked");
		await dispatch(context, scoreTop({
			totalElements: 15,
			elementsPerPage: 10,
			timing: TopTiming.WEEK
		}));
		const buttons = componentsOf(singleMessage(interaction));
		expect(buttons.find(button => button.custom_id === "previous")?.disabled).toBe(true);
		const click = fakeClick(interaction.user, "next");

		const turning = clickOn(interaction.collectors[0], click);
		await new Promise(resolveRequest => setTimeout(resolveRequest, 0));
		const [request] = sentPackets(CommandTopPacketReq);
		expect(request.packet).toMatchObject({
			dataType: TopDataType.SCORE,
			timing: TopTiming.WEEK,
			page: 2
		});
		await dispatch(request.context, makePacket(CommandTopPacketResScore, {
			...scoreTop(),
			elements: [scoreElement(11, "first-keycloak-id")],
			pageNumber: 2
		}));
		await turning;
		await new Promise(resolveRender => setTimeout(resolveRender, 0));

		const page = lastMessage(click);
		expect(embedsOf(page)[0].title).toContain("places 11 à 15");
		expect(descriptionLines(page)[0]).toContain("Leader");
		expect(componentsOf(page).find(button => button.custom_id === "next")?.disabled).toBe(true);
	});

	it.each([
		[makePacket(CommandTopPlayersEmptyPacket, {}), "Aucun joueur n'est actuellement classé !"],
		[makePacket(CommandTopPlayersEmptyPacket, { needFight: 2 }), "Réalisez encore 2 combat"],
		[makePacket(CommandTopGuildsEmptyPacket, {}), "aucune guilde"]
	])("tells that the top is empty (%o)", async (packet, expected) => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, packet);

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain(expected);
	});
});
