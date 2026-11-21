import {
	beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", async () => (await import("../../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../../src/packetHandlers/handlers/commands/player/ClassesInfoCommandPacketHandlers";
import "../../../src/packetHandlers/handlers/commands/player/MapDisplayCommandPacketHandlers";
import "../../../src/packetHandlers/handlers/commands/player/RespawnCommandPacketHandlers";
import "../../../src/packetHandlers/handlers/commands/player/UpdateCommandPacketHandlers";
import "../../../src/packetHandlers/handlers/commands/player/GardenCommandPacketHandlers";
import "../../../src/packetHandlers/handlers/commands/player/ClassesCommandPacketHandlers";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandClassesInfoPacketRes } from "../../../../Lib/src/packets/commands/CommandClassesInfoPacket";
import { CommandMapDisplayRes } from "../../../../Lib/src/packets/commands/CommandMapPacket";
import { CommandRespawnPacketRes } from "../../../../Lib/src/packets/commands/CommandRespawnPacket";
import { CommandUpdatePacketRes } from "../../../../Lib/src/packets/commands/CommandUpdatePacket";
import {
	CommandGardenClosedRes, CommandGardenNoAccessRes, GardenNoAccessReason
} from "../../../../Lib/src/packets/commands/CommandGardenPacket";
import { CommandClassesCooldownErrorPacket } from "../../../../Lib/src/packets/commands/CommandClassesPacket";
import { ClassInfoConstants } from "../../../../Lib/src/constants/ClassInfoConstants";
import { ClassStats } from "../../../../Lib/src/types/ClassStats";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	clickOn, componentsOf, dispatch, embedsOf, ERROR_COLOR, fakeClick, fakeCommand, fakeUser, lastMessage, setupRendering,
	singleMessage
} from "../../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

function classStats(attack: number): ClassStats {
	return {
		attack,
		defense: 20,
		speed: 10,
		health: 65,
		classGroup: 0,
		fightPoint: 45,
		baseBreath: 4,
		maxBreath: 10,
		breathRegen: 4,
		classKind: "basic"
	} as ClassStats;
}

describe("classes info", () => {
	const classesInfo = makePacket(CommandClassesInfoPacketRes, {
		data: {
			classesStats: [
				{
					id: 0,
					stats: classStats(25),
					attacks: [
						{
							id: "simpleAttack",
							cost: 2
						}
					]
				},
				{
					id: 1,
					stats: classStats(30),
					attacks: [
						{
							id: "simpleAttack",
							cost: 2
						},
						{
							id: "quickAttack",
							cost: 1
						}
					]
				}
			]
		}
	});

	it("lists the classes with their stats and a menu to see the details of each one", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, classesInfo);

		const message = singleMessage(interaction);
		const [embed] = embedsOf(message);
		expect(embed.fields).toHaveLength(2);
		expect(embed.fields?.[1].value).toContain("30");
		const [menu] = componentsOf(message);
		expect(menu.options?.map(option => option.value)).toEqual([ClassInfoConstants.MENU_IDS.LIST_OPTION, "0", "1"]);
	});

	it("details the attacks of the selected class and goes back to the list", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, classesInfo);
		const selection = fakeClick(interaction.user, ClassInfoConstants.MENU_IDS.CLASS_SELECTION, ["1"]);
		const back = fakeClick(interaction.user, ClassInfoConstants.MENU_IDS.CLASS_SELECTION, [ClassInfoConstants.MENU_IDS.LIST_OPTION]);

		await clickOn(interaction.collectors[0], selection);
		await clickOn(interaction.collectors[0], back);

		const [details] = embedsOf(lastMessage(selection));
		expect(details.fields?.map(field => field.name)).toHaveLength(2);
		expect(details.fields?.[1].name).toContain(CrowniclesIcons.fightActions.quickAttack);
		expect(embedsOf(lastMessage(back))[0].fields).toHaveLength(2);
	});

	it("refuses the selections of another player", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, classesInfo);
		const intruder = fakeClick(fakeUser("Intruder"), ClassInfoConstants.MENU_IDS.CLASS_SELECTION, ["1"]);

		await clickOn(interaction.collectors[0], intruder);

		expect(embedsOf(lastMessage(intruder))[0].color).toBe(ERROR_COLOR);
	});
});

describe("map", () => {
	it.each([
		[false, "vous vous dirigez"],
		[true, "Vous êtes arrivé"]
	])("describes the destination (arrived: %s) on the map with the cursor", async (hasArrived, expected) => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandMapDisplayRes, {
			mapId: 1,
			mapType: "be",
			mapLink: {
				name: "1_2",
				forced: false
			},
			hasArrived
		}));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.description).toContain(expected);
		expect(embed.description).toContain(CrowniclesIcons.mapTypes.be);
		expect(embed.image?.url).toBe(MapConstants.MAP_URL_WITH_CURSOR.replace("{mapLink}", "1_2"));
	});

	it("shows the forced map of a special place", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandMapDisplayRes, {
			mapId: 1,
			mapType: "be",
			mapLink: {
				name: "pveIsland",
				forced: true
			},
			hasArrived: true
		}));

		expect(embedsOf(singleMessage(interaction))[0].image?.url).toBe(MapConstants.FORCED_MAPS_URL.replace("{name}", "pveIsland"));
	});
});

describe("respawn", () => {
	it.each([
		[1, "qu'1"],
		[250, "250"]
	])("tells the score lost by the respawn (%i)", async (lostScore, expected) => {
		const {
			interaction, context
		} = fakeCommand("Phoenix");
		await dispatch(context, makePacket(CommandRespawnPacketRes, { lostScore }));

		const message = singleMessage(interaction);
		expect(message.payload).toMatchObject({ content: expect.stringContaining("Phoenix") });
		expect((message.payload as { content: string }).content).toContain(expected);
	});
});

describe("update", () => {
	it("shows the versions of the core and of the Discord module", async () => {
		vi.stubEnv("npm_package_version", "6.1.0");
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandUpdatePacketRes, { coreVersion: "6.0.9" }));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.description).toContain("**6.0.9**");
		expect(embed.description).toContain("**6.1.0**");
		vi.unstubAllEnvs();
	});
});

describe("garden", () => {
	it("gives its own explanation to each reason the garden cannot be reached", async () => {
		const descriptions = new Set<string | undefined>();
		for (const reason of Object.values(GardenNoAccessReason)) {
			const {
				interaction, context
			} = fakeCommand("Gardener");
			await dispatch(context, makePacket(CommandGardenNoAccessRes, { reason }));
			const [embed] = embedsOf(singleMessage(interaction));
			expect(embed.author?.name).toContain("Gardener");
			descriptions.add(embed.description);
		}

		expect(descriptions.size).toBe(Object.values(GardenNoAccessReason).length);
	});

	it("closes the garden in a follow-up", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandGardenClosedRes, {}));

		const message = singleMessage(interaction);
		expect(message.method).toBe("followUp");
		expect(embedsOf(message)[0].description).toContain("La consultation du jardin est terminée.");
	});
});

describe("classes cooldown", () => {
	it("tells when the class can be changed again", async () => {
		const {
			interaction, context
		} = fakeCommand();
		await dispatch(context, makePacket(CommandClassesCooldownErrorPacket, { timestamp: Date.now() + 86_400_000 }));

		const [embed] = embedsOf(singleMessage(interaction));
		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toMatch(/\d/);
	});
});
