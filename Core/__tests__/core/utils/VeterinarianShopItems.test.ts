import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { getVeterinarianShopItem } from "../../../src/core/utils/VeterinarianShopItems";
import { Players } from "../../../src/core/database/game/models/Player";
import {
	PetEntities, PetEntity
} from "../../../src/core/database/game/models/PetEntity";
import { DwarfPetsSeen } from "../../../src/core/database/game/models/DwarfPetsSeen";
import { CommandMissionShopPetInformation } from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { asPlayer } from "../ModelStubs";

const DOG = 1;
const PET_WITHOUT_TAG = 5;

async function examine(typeId: number): Promise<CommandMissionShopPetInformation> {
	vi.spyOn(Players, "getById").mockResolvedValue(asPlayer({ id: 7, petId: 3 }));
	vi.spyOn(PetEntities, "getById").mockResolvedValue({
		id: 3,
		typeId,
		nickname: "Rex",
		sex: PetConstants.SEX.MALE,
		lovePoints: 60,
		needsVeterinarianCare: () => false,
		getLoveLevelNumber: () => 3,
		getFeedCooldown: () => 0
	} as unknown as PetEntity); // Only the fields the veterinarian reads
	vi.spyOn(DwarfPetsSeen, "getRandomPetNotSeenId").mockResolvedValue(0);
	const response: CrowniclesPacket[] = [];

	await getVeterinarianShopItem().buyCallback(response, 7, {} as PacketContext, 1);

	return response.find(packet => packet instanceof CommandMissionShopPetInformation) as CommandMissionShopPetInformation;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("veterinarian", () => {
	it("tells the abilities of the pet that some big event outcomes depend on", async () => {
		expect((await examine(DOG)).tags).toEqual([PetConstants.TAGS.KEEN_NOSE]);
	});

	it("tells no ability for a pet without any", async () => {
		expect((await examine(PET_WITHOUT_TAG)).tags).toEqual([]);
	});
});
