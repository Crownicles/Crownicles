import { describe, expect, it, vi } from "vitest";
import { makePacket, PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandBlessingPacketRes, RequirementOracleNotMetPacket } from "../../../Lib/src/packets/commands/CommandBlessingPacket";
import { CommandRarityPacketRes } from "../../../Lib/src/packets/commands/CommandRarityPacket";
import CharacterCommandServerTranslator from "../../src/packets/fromServer/translators/CharacterCommandServerTranslator";
import { BlessingAnnouncementPacket } from "../../../Lib/src/packets/announcements/BlessingAnnouncementPacket";
import { translateBlessingAnnouncement } from "../../src/packets/fromServer/BlessingAnnouncement";

vi.mock("../../src/index", () => ({keycloakConfig: {}}));
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", () => ({KeycloakUtils: {getUserByKeycloakId: vi.fn(async (_config, id) => ({isError: id === "missing", payload: {user: {username: "fallback", attributes: {gameUsername: ["Aventurier"]}}}}))}}));

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

describe("character reference commands", () => {
	it("preserves Core's rarity percentages without normalizing or rounding", async () => {
		const rarities = [0, 43.768, 25, 15, 10, 5, 1, 0.22, 0.012];
		const result = await CharacterCommandServerTranslator.rarity(CONTEXT, makePacket(CommandRarityPacketRes, {rarities}));
		expect(result.rarities).toEqual(rarities);
	});

	it("resolves contributor names without exposing identity IDs", async () => {
		const result = await CharacterCommandServerTranslator.blessing(CONTEXT, makePacket(CommandBlessingPacketRes, {activeBlessingType: 4, blessingEndAt: 1_900_000_000_000, poolAmount: 50, poolThreshold: 100, lastTriggeredByKeycloakId: "trigger", topContributorKeycloakId: "contributor", topContributorAmount: 40, totalContributors: 2, poolExpiresAt: 0}));
		expect(JSON.parse(JSON.stringify(result))).toEqual({activeBlessingType: 4, blessingEndAt: 1_900_000_000_000, poolAmount: 50, poolThreshold: 100, lastTriggeredBy: "Aventurier", topContributor: "Aventurier", topContributorAmount: 40, totalContributors: 2, poolExpiresAt: 0});
	});

	it("keeps the pool available when a contributor account was removed", async () => {
		const result = await CharacterCommandServerTranslator.blessing(CONTEXT, makePacket(CommandBlessingPacketRes, {activeBlessingType: 0, poolAmount: 50, poolThreshold: 100, totalContributors: 2, poolExpiresAt: 1_900_000_000_000, topContributorKeycloakId: "missing"}));
		expect(result.poolAmount).toBe(50);
		expect(result).not.toHaveProperty("topContributor");
		expect(result).not.toHaveProperty("topContributorKeycloakId");
	});

	it("exposes the Oracle encounter requirement", async () => {
		expect(await CharacterCommandServerTranslator.oracle(CONTEXT, makePacket(RequirementOracleNotMetPacket, {}))).toMatchObject({rejection: {type: "oracle"}});
	});

	it("tells connected players which blessing started without exposing identity IDs", () => {
		const result = translateBlessingAnnouncement(makePacket(BlessingAnnouncementPacket, {blessingType: 4, durationHours: 12, triggeredByKeycloakId: "trigger", topContributorKeycloakId: "contributor", topContributorAmount: 40, totalContributors: 2}));
		expect(JSON.parse(JSON.stringify(result))).toEqual({blessingType: 4, durationHours: 12});
	});
});