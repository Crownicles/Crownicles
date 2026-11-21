import {
	beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => {
	const { shardMock } = await import("../mocks/DiscordRenderMocks");
	return {
		...shardMock,
		crowniclesClient: {
			...shardMock.crowniclesClient,
			isReady: vi.fn(() => true),
			channels: { fetch: vi.fn() }
		}
	};
});
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);

import "../../src/packetHandlers/handlers/commands/admin/TestCommandPacketHandlers";
import { crowniclesClient } from "../../src/bot/CrowniclesShard";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { CommandTestPacketRes } from "../../../Lib/src/packets/commands/CommandTestPacket";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	dispatch, embedsOf, ERROR_COLOR, fakeCommand, RenderedMessage, setupRendering, singleMessage
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

describe("test command results", () => {
	// A content in the reply makes Discord refuse the city menu that Core can send with the result (components V2)
	it("displays a failed test command in an error embed, without any content", async () => {
		const command = fakeCommand();

		await dispatch(command.context, makePacket(CommandTestPacketRes, {
			commandName: "changeClass",
			result: "Erreur class : choisissez une classe qui existe !",
			isError: true
		}));

		const message = singleMessage(command.interaction);
		expect(message.payload).not.toHaveProperty("content");
		expect(embedsOf(message)).toMatchObject([{
			description: "Erreur class : choisissez une classe qui existe !",
			color: ERROR_COLOR
		}]);
	});

	it("displays a successful test command in an embed naming the command", async () => {
		const command = fakeCommand();

		await dispatch(command.context, makePacket(CommandTestPacketRes, {
			commandName: "changeClass",
			result: "Vous avez maintenant la classe d'id : 3 !",
			isError: false
		}));

		const [embed] = embedsOf(singleMessage(command.interaction));
		expect(embed.author?.name).toBe("Commande test changeClass exécutée :");
		expect(embed.description).toBe("Vous avez maintenant la classe d'id : 3 !");
	});
});

describe("test command results without the interaction", () => {
	const failure = makePacket(CommandTestPacketRes, {
		commandName: "changeClass", result: "Erreur class", isError: true
	});
	const success = makePacket(CommandTestPacketRes, {
		commandName: "changeClass", result: "Classe changée", isError: false
	});

	// Context of a command whose interaction is no longer cached, for example after a restart of the shard
	function orphanContext(channel = "channel-id"): PacketContext {
		return {
			keycloakId: "keycloak-id",
			discord: {
				interaction: "forgotten-interaction", user: "user-id", channel, language: "fr", shardId: 0
			}
		} as PacketContext;
	}

	function fakeChannel(textBased = true): {
		sent: RenderedMessage[]; isTextBased: () => boolean; send: (payload: unknown) => Promise<void>;
	} {
		const sent: RenderedMessage[] = [];
		return {
			sent,
			isTextBased: (): boolean => textBased,
			send: (payload: unknown): Promise<void> => {
				sent.push({
					method: "channel.send", payload
				});
				return Promise.resolve();
			}
		};
	}

	beforeEach(() => {
		vi.mocked(crowniclesClient.isReady).mockReturnValue(true);
		vi.mocked(CrowniclesLogger.warn).mockClear();
	});

	it.each([
		["a failed", failure, { description: "Erreur class", color: ERROR_COLOR }],
		["a successful", success, { description: "Classe changée", author: { name: "Commande test changeClass exécutée :" } }]
	])("delivers %s test command in the channel of the command", async (_case, packet, expectedEmbed) => {
		const channel = fakeChannel();
		vi.mocked(crowniclesClient.channels.fetch).mockResolvedValueOnce(channel as never);

		await dispatch(orphanContext(), packet);

		expect(crowniclesClient.channels.fetch).toHaveBeenLastCalledWith("channel-id");
		expect(embedsOf(singleMessage({ messages: channel.sent }))).toMatchObject([expectedEmbed]);
	});

	it("delivers nothing when the channel of the command is unknown, unreachable or not a text channel", async () => {
		const voiceChannel = fakeChannel(false);
		vi.mocked(crowniclesClient.channels.fetch).mockResolvedValueOnce(voiceChannel as never)
			.mockRejectedValueOnce(new Error("Missing access"));

		await dispatch(orphanContext(""), failure);
		await dispatch(orphanContext(), failure);
		await dispatch(orphanContext(), failure);

		expect(voiceChannel.sent).toEqual([]);
		expect(CrowniclesLogger.warn).toHaveBeenCalledTimes(3);
	});

	it("logs a result the channel refused, even when the author cannot be fetched for the avatar", async () => {
		const channel = Object.assign(fakeChannel(), { send: vi.fn().mockRejectedValue(new Error("Missing permissions")) });
		vi.mocked(crowniclesClient.channels.fetch).mockResolvedValueOnce(channel as never);
		const fetchUser = vi.spyOn(crowniclesClient.users, "fetch").mockRejectedValueOnce(new Error("Unknown user"));
		vi.mocked(CrowniclesLogger.errorWithObj).mockClear();

		await dispatch(orphanContext(), success);

		expect(fetchUser).toHaveBeenCalledWith("user-id");
		expect(channel.send).toHaveBeenCalledOnce();
		expect(CrowniclesLogger.errorWithObj).toHaveBeenCalledWith("Failed to deliver test command result in fallback", expect.any(Error));
	});

	it("delivers nothing while the Discord client is not ready", async () => {
		vi.mocked(crowniclesClient.isReady).mockReturnValue(false);
		vi.mocked(crowniclesClient.channels.fetch).mockClear();

		await dispatch(orphanContext(), success);

		expect(crowniclesClient.channels.fetch).not.toHaveBeenCalled();
		expect(CrowniclesLogger.warn).toHaveBeenCalledOnce();
	});

	it("posts the result in the channel once the command already answered", async () => {
		const command = fakeCommand();
		command.interaction.replied = true;

		await dispatch(command.context, failure);

		expect(singleMessage(command.interaction).method).toBe("channel.send");
	});
});
