import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/gardener";
import { PlayerSmallEvents } from "../../../src/core/database/game/models/PlayerSmallEvent";
import { Homes } from "../../../src/core/database/game/models/Home";
import { HomeGardenSlots } from "../../../src/core/database/game/models/HomeGardenSlot";
import { PlayerPlantSlots } from "../../../src/core/database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../../../src/core/database/game/models/InventoryInfo";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { PetDataController } from "../../../src/data/Pet";
import { LogsReadRequests } from "../../../src/core/database/logs/LogsReadRequests";
import { MaterialDataController } from "../../../src/data/Material";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	GARDENER_INTERACTIONS, PlantConstants, PlantId, SEED_CONDITION_FAILURE
} from "../../../../Lib/src/constants/PlantConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { givePlantsToPlayer } from "../../../src/core/utils/PlantDeliveryUtils";
import { SmallEventGardenerPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";

vi.mock("../../../src/core/utils/PlantDeliveryUtils", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/utils/PlantDeliveryUtils")>(),
	givePlantsToPlayer: vi.fn()
}));

vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({
	applyMaterialLoot: vi.fn(),
	updateCollectMaterialsMission: vi.fn()
}));

const NOON = new Date(2026, 10, 14, 12, 0, 0);

type GardenerTestPlayer = {
	id: number;
	keycloakId: string;
	level: number;
	money: number;
	petId: number | null;
};

function makePlayer(overrides: Partial<GardenerTestPlayer> = {}): GardenerTestPlayer {
	return {
		id: 1,
		keycloakId: "keycloak",
		level: 100,
		money: 0,
		petId: null,
		...overrides
	};
}

/**
 * The player's next seed is the one following the highest plant of their garden
 */
function mockNextSeed(seedId: PlantId): void {
	vi.spyOn(HomeGardenSlots, "getHighestPlantedId").mockResolvedValue(seedId - 1);
}

function mockPetTags(tags: string[]): void {
	vi.spyOn(PetEntities, "getById").mockResolvedValue({ typeId: 1 } as never);
	vi.spyOn(PetDataController.instance, "getById").mockReturnValue({ hasTag: (tag: string) => tags.includes(tag) } as never);
}

function isGuaranteed(player: GardenerTestPlayer): Promise<boolean> {
	return smallEventFuncs.isGuaranteed!(player as never);
}

describe("gardener seed favors and guaranteed encounter", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOON);
		vi.spyOn(PlayerSmallEvents, "countSmallEventsOfPlayer").mockResolvedValue(PlantConstants.GARDENER_GUARANTEED_AFTER_SMALL_EVENTS);
		vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({
			id: 9,
			getLevel: () => ({ features: { gardenPlots: 4 } })
		} as never);
		vi.spyOn(PlayerPlantSlots, "getSeedSlot").mockResolvedValue(null);
		vi.spyOn(LogsReadRequests, "hasSleptInInnDuringLast").mockResolvedValue(false);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("is not guaranteed before enough small events happened on the path", async () => {
		vi.spyOn(PlayerSmallEvents, "countSmallEventsOfPlayer").mockResolvedValue(PlantConstants.GARDENER_GUARANTEED_AFTER_SMALL_EVENTS - 1);
		mockNextSeed(PlantId.COMMON_HERB);
		expect(await isGuaranteed(makePlayer())).toBe(false);
	});

	it("is not guaranteed in daylight to a player who cannot earn the lunar moss", async () => {
		mockNextSeed(PlantId.LUNAR_MOSS);
		expect(await isGuaranteed(makePlayer())).toBe(false);
	});

	it("hands over the lunar moss to a player with a flying pet in daylight", async () => {
		mockNextSeed(PlantId.LUNAR_MOSS);
		mockPetTags([PetConstants.TAGS.FLYING]);
		expect(await isGuaranteed(makePlayer({ petId: 1 }))).toBe(true);
	});

	it("hands over the lunar moss to a player who recently slept in an inn", async () => {
		mockNextSeed(PlantId.LUNAR_MOSS);
		vi.spyOn(LogsReadRequests, "hasSleptInInnDuringLast").mockResolvedValue(true);
		expect(await isGuaranteed(makePlayer())).toBe(true);
	});

	it("hands over the night mushroom to a player with a nocturnal pet in daylight, but not with a flying one", async () => {
		mockNextSeed(PlantId.NIGHT_MUSHROOM);
		mockPetTags([PetConstants.TAGS.FLYING]);
		expect(await isGuaranteed(makePlayer({ petId: 1 }))).toBe(false);

		mockPetTags([PetConstants.TAGS.NOCTURNAL]);
		expect(await isGuaranteed(makePlayer({ petId: 1 }))).toBe(true);
	});

	describe("blocked seed", () => {
		beforeEach(() => {
			vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue({ plantSlots: 1 } as never);
			vi.spyOn(PlayerPlantSlots, "initializeSlots").mockResolvedValue();
			vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(2);
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
			vi.spyOn(MaterialDataController.instance, "getRandomMaterialFromRarity").mockReturnValue({ id: "5" } as never);
			mockNextSeed(PlantId.LUNAR_MOSS);
		});

		async function executeForLowLevelPlayer(): Promise<SmallEventGardenerPacket> {
			const response: CrowniclesPacket[] = [];
			await smallEventFuncs.executeSmallEvent(makePlayer({ level: 1 }) as never, {
				response,
				context: {} as never,
				playerActiveObjects: {} as never
			});
			return response.find(packet => "conditionKey" in packet) as SmallEventGardenerPacket;
		}

		it("always explains what is missing and adds a plant as consolation", async () => {
			vi.mocked(givePlantsToPlayer).mockResolvedValue({
				delivered: true,
				toHomeStorage: 0,
				toPlantSlots: 1
			});

			const packet = await executeForLowLevelPlayer();

			expect(packet.interactionName).toBe(GARDENER_INTERACTIONS.ADVICE);
			expect(packet.conditionKey).toBe(SEED_CONDITION_FAILURE.NEED_LEVEL);
			expect(packet.plantId).toBe(PlantId.LUNAR_MOSS);
			expect(packet.consolation).toEqual({
				plantId: expect.any(Number),
				sentToHomeStorage: false
			});
		});

		it("gives a material as consolation when the player has no room for a plant", async () => {
			vi.mocked(givePlantsToPlayer).mockResolvedValue({
				delivered: false,
				reason: "plantSlotsFull" as never
			});

			const packet = await executeForLowLevelPlayer();

			expect(packet.conditionKey).toBe(SEED_CONDITION_FAILURE.NEED_LEVEL);
			expect(packet.consolation).toEqual({ materialId: 5 });
		});
	});
});
