import {
	beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../src/packetHandlers/handlers/commands/player/DailyBonusCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/DrinkCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/RarityCommandPacketHandlers";
import "../../src/packetHandlers/handlers/commands/player/BlessingCommandPacketHandlers";
import {
	CrowniclesPacket, makePacket
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandDailyBonusCancelPacket,
	CommandDailyBonusInCooldown,
	CommandDailyBonusNoAvailableObject,
	CommandDailyBonusPacketRes
} from "../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import {
	CommandDrinkCancelDrink, CommandDrinkNoAvailablePotion, CommandDrinkPacketRes
} from "../../../Lib/src/packets/commands/CommandDrinkPacket";
import { CommandRarityPacketRes } from "../../../Lib/src/packets/commands/CommandRarityPacket";
import { CommandBlessingPacketRes } from "../../../Lib/src/packets/commands/CommandBlessingPacket";
import { ItemNature } from "../../../Lib/src/constants/ItemConstants";
import { BlessingType } from "../../../Lib/src/constants/BlessingConstants";
import {
	dispatch, embedsOf, ERROR_COLOR, fakeCommand, setupRendering, RenderedEmbed, singleMessage
} from "../mocks/DiscordRenderHarness";
import { knownPlayers } from "../mocks/DiscordRenderMocks";

/**
 * Dispatch a packet answering a new command and return the single embed displayed
 */
async function renderEmbed(packet: CrowniclesPacket, userName = "Player"): Promise<RenderedEmbed> {
	const {
		interaction, context
	} = fakeCommand(userName);
	await dispatch(context, packet);
	const embeds = embedsOf(singleMessage(interaction));
	expect(embeds).toHaveLength(1);
	return embeds[0];
}

beforeAll(() => {
	setupRendering();
});

describe("daily bonus packets", () => {
	it("displays the health won by the daily object", async () => {
		const embed = await renderEmbed(makePacket(CommandDailyBonusPacketRes, {
			value: 42,
			itemNature: ItemNature.HEALTH
		}), "Alice");

		expect(embed.author?.name).toContain("Alice");
		expect(embed.description).toContain("**42**");
	});

	it("displays a time speedup as a duration rather than a raw number of minutes", async () => {
		const embed = await renderEmbed(makePacket(CommandDailyBonusPacketRes, {
			value: 90,
			itemNature: ItemNature.TIME_SPEEDUP
		}));

		expect(embed.description).not.toContain("**90**");
		expect(embed.description).toMatch(/1\s*h/);
	});

	it.each([
		[CommandDailyBonusNoAvailableObject, "aucun objet utilisable"],
		[CommandDailyBonusCancelPacket, "annulé"]
	])("displays the error of %o", async (packetClass, expected) => {
		const embed = await renderEmbed(makePacket(packetClass, {}));

		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain(expected);
	});

	it("tells when the next daily object is available", async () => {
		const embed = await renderEmbed(makePacket(CommandDailyBonusInCooldown, {
			lastDailyTimestamp: Date.now(),
			timeBetweenDailies: 22
		}));

		expect(embed.color).toBe(ERROR_COLOR);
		expect(embed.description).toContain("22 heures");
	});
});

describe("drink packets", () => {
	it("displays the effect of the potion", async () => {
		const embed = await renderEmbed(makePacket(CommandDrinkPacketRes, {
			value: 30,
			itemNature: ItemNature.ENERGY
		}), "Bob");

		expect(embed.author?.name).toContain("Bob");
		expect(embed.description).toContain("30");
	});

	it("displays a potion without effect with its own sentence", async () => {
		const withEffect = await renderEmbed(makePacket(CommandDrinkPacketRes, {
			value: 30,
			itemNature: ItemNature.ENERGY
		}));
		const withoutEffect = await renderEmbed(makePacket(CommandDrinkPacketRes, {
			value: 0,
			itemNature: ItemNature.NONE
		}));

		expect(withoutEffect.description).not.toBe(withEffect.description);
		expect(withoutEffect.description).not.toContain("**0**");
	});

	it.each([CommandDrinkCancelDrink, CommandDrinkNoAvailablePotion])("displays the error of %o", async packetClass => {
		const embed = await renderEmbed(makePacket(packetClass, {}));

		expect(embed.color).toBe(ERROR_COLOR);
	});
});

describe("rarity packet", () => {
	it("lists every rarity, the first one being described instead of given a percentage", async () => {
		const embed = await renderEmbed(makePacket(CommandRarityPacketRes, {
			rarities: [0, 40.5, 25, 10]
		}));

		const lines = embed.description?.split("\n") ?? [];
		expect(lines).toHaveLength(4);
		expect(lines[0]).not.toContain("%");
		expect(lines[1]).toContain("40.5%");
		expect(lines[3]).toContain("10%");
	});
});

describe("blessing packet", () => {
	const collecting = {
		activeBlessingType: BlessingType.NONE,
		poolAmount: 1200,
		poolThreshold: 5000,
		poolExpiresAt: Date.now() + 3_600_000,
		topContributorAmount: 0,
		totalContributors: 0
	};

	it("shows the pool progress while collecting", async () => {
		const embed = await renderEmbed(makePacket(CommandBlessingPacketRes, collecting));

		expect(embed.description).toMatch(/1[\s\u202f]?200/);
		expect(embed.description).toMatch(/5[\s\u202f]?000/);
	});

	it("adds the top contributor below the pool progress once somebody gave", async () => {
		knownPlayers.set("generous-keycloak-id", "Generous");
		const embed = await renderEmbed(makePacket(CommandBlessingPacketRes, {
			...collecting,
			topContributorKeycloakId: "generous-keycloak-id",
			topContributorAmount: 800,
			totalContributors: 3
		}));

		const withoutContributors = await renderEmbed(makePacket(CommandBlessingPacketRes, collecting));
		expect(embed.description?.startsWith(`${withoutContributors.description}\n\n`)).toBe(true);
		expect(embed.description).toContain("Generous");
		expect(embed.description).toContain("800");
	});

	it("shows the active blessing, with its own title, and who triggered it", async () => {
		knownPlayers.set("trigger-keycloak-id", "Trigger");
		const collectingEmbed = await renderEmbed(makePacket(CommandBlessingPacketRes, collecting));
		const embed = await renderEmbed(makePacket(CommandBlessingPacketRes, {
			...collecting,
			activeBlessingType: BlessingType.MONEY_BOOST,
			blessingEndAt: Date.now() + 3_600_000,
			lastTriggeredByKeycloakId: "trigger-keycloak-id"
		}));

		expect(embed.description).toContain("Trigger");
		expect(embed.author?.name).not.toBe(collectingEmbed.author?.name);
	});
});
