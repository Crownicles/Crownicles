import {
	beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);

import "../../src/packetHandlers/handlers/commands/missions/MissionShopCommandPacketHandlers";
import { CommandMissionShopPetInformation } from "../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { makePacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { PetConstants } from "../../../Lib/src/constants/PetConstants";
import {
	dispatch, embedsOf, fakeCommand, lastMessage, setupRendering
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

async function renderVeterinarianReport(tags: CommandMissionShopPetInformation["tags"]): Promise<string> {
	const {
		interaction, context
	} = fakeCommand();
	await dispatch(context, makePacket(CommandMissionShopPetInformation, {
		nickname: "Rex",
		petId: 1,
		typeId: 1,
		sex: PetConstants.SEX.MALE as "m",
		loveLevel: 3,
		lovePoints: 60,
		diet: "omnivorous",
		nextFeed: 0,
		fightAssistIds: ["bite"],
		ageCategory: "old",
		force: 10,
		speed: 10,
		feedDelay: 3_600_000,
		tags
	}));
	return embedsOf(lastMessage(interaction))[0].description ?? "";
}

describe("veterinarian report", () => {
	it("lists the abilities of the pet, so that the player knows which event outcomes it can trigger", async () => {
		const description = await renderVeterinarianReport([PetConstants.TAGS.FLYING, PetConstants.TAGS.KEEN_NOSE]);

		expect(description).toContain("**Aptitudes** : vole, a du flair");
	});

	it("names every pet ability", async () => {
		const description = await renderVeterinarianReport(Object.values(PetConstants.TAGS));

		expect(description).not.toContain("petTags");
	});

	it("leaves out the abilities line of a pet without any", async () => {
		const description = await renderVeterinarianReport([]);

		expect(description).not.toContain("Aptitudes");
	});
});
