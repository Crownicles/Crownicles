import {
	beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);

import "../../src/packetHandlers/handlers/commands/admin/TestCommandPacketHandlers";
import { CommandTestPacketRes } from "../../../Lib/src/packets/commands/CommandTestPacket";
import { makePacket } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	dispatch, embedsOf, ERROR_COLOR, fakeCommand, setupRendering, singleMessage
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
