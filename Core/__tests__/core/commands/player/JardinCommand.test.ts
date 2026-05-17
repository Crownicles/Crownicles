import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { JardinCommand } from "../../../../src/commands/player/JardinCommand";
import { Homes } from "../../../../src/core/database/game/models/Home";
import { CityDataController } from "../../../../src/data/City";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import { MapLocationDataController } from "../../../../src/data/MapLocation";
import { TravelTime } from "../../../../src/core/maps/TravelTime";
import { BlockingUtils } from "../../../../src/core/utils/BlockingUtils";
import { buildGardenData } from "../../../../src/core/report/ReportGardenService";
import {
	CommandJardinNoAccessRes, JardinNoAccessReason
} from "../../../../../Lib/src/packets/commands/CommandJardinPacket";
import { GardenAccessMode } from "../../../../../Lib/src/types/GardenAccessMode";

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: {
		DISALLOWED_EFFECTS: {
			NOT_STARTED_OR_DEAD: []
		},
		WHERE: {
			EVERYWHERE: []
		}
	}
}));

vi.mock("../../../../src/core/database/game/models/Home");
vi.mock("../../../../src/core/database/game/models/InventorySlot");
vi.mock("../../../../src/data/City");
vi.mock("../../../../src/data/MapLocation");
vi.mock("../../../../src/core/maps/TravelTime");
vi.mock("../../../../src/core/utils/BlockingUtils");
vi.mock("../../../../src/core/report/ReportGardenService");
vi.mock("../../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		block(): this {
			return this;
		}

		build(): { type: string } {
			return { type: "ReactionCollectorCityPacket" };
		}
	}
}));
vi.mock("../../../../../Lib/src/packets/CrowniclesPacket", () => ({
	CrowniclesPacket: class {},
	PacketContext: class {},
	PacketDirection: {
		NONE: 0,
		FRONT_TO_BACK: 1,
		BACK_TO_FRONT: 2
	},
	sendablePacket: vi.fn(() => () => {}),
	makePacket: vi.fn((PacketType, data) => ({
		type: PacketType.name,
		data
	}))
}));

describe("JardinCommand", () => {
	const player = {
		id: 42,
		keycloakId: "player-keycloak-id",
		hasRemoteHarvestTalisman: false,
		getDestinationId: vi.fn(() => 7),
		getCumulativeEnergy: vi.fn(() => 100),
		getMaxCumulativeEnergy: vi.fn(() => 200),
		getHealth: vi.fn(() => 50),
		getMaxHealth: vi.fn(() => 100)
	};
	const context = {};

	beforeEach(() => {
		vi.clearAllMocks();
		player.hasRemoteHarvestTalisman = false;

		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([]);
		vi.mocked(InventorySlots.slotsToActiveObjects).mockReturnValue({} as never);
		vi.mocked(TravelTime.getTravelDataSimplified).mockReturnValue({
			travelStartTime: 1_700_000_000_000
		} as never);
		vi.mocked(MapLocationDataController.instance.getById).mockReturnValue({
			type: "city"
		} as never);
		vi.mocked(buildGardenData).mockResolvedValue({
			plots: [],
			plantStorage: [],
			hasSeed: false,
			seedPlantId: 0,
			totalPlots: 1,
			accessMode: GardenAccessMode.FULL,
			wateringAvailableAt: null
		} as never);
		vi.mocked(BlockingUtils.unblockPlayer).mockResolvedValue();
	});

	it("responds with NO_HOME when the player owns no home", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(null as never);

		const response: { type: string; data: { reason: string } }[] = [];
		await new JardinCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response).toHaveLength(1);
		expect(response[0].type).toBe(CommandJardinNoAccessRes.name);
		expect(response[0].data.reason).toBe(JardinNoAccessReason.NO_HOME);
	});

	it("responds with NO_GARDEN when the home has no garden plots", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue({
			id: 1,
			level: 2,
			cityId: "coco",
			getLevel: () => ({
				features: { gardenPlots: 0 }
			})
		} as never);

		const response: { type: string; data: { reason: string } }[] = [];
		await new JardinCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response[0].data.reason).toBe(JardinNoAccessReason.NO_GARDEN);
	});

	it("responds with NO_TALISMAN when the player is away and lacks the talisman", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue({
			id: 1,
			level: 2,
			cityId: "coco",
			getLevel: () => ({
				features: { gardenPlots: 1 }
			})
		} as never);
		vi.mocked(CityDataController.instance.getCityByMapId).mockReturnValue({
			id: "other-city"
		} as never);

		const response: { type: string; data: { reason: string } }[] = [];
		await new JardinCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response[0].data.reason).toBe(JardinNoAccessReason.NO_TALISMAN);
	});

	it("builds a garden-only collector with FULL access when the player is in their home city", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue({
			id: 1,
			level: 2,
			cityId: "coco",
			getLevel: () => ({
				features: { gardenPlots: 1 }
			})
		} as never);
		vi.mocked(CityDataController.instance.getCityByMapId).mockReturnValue({
			id: "coco"
		} as never);

		const response: unknown[] = [];
		await new JardinCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response).toHaveLength(1);
		expect(buildGardenData).toHaveBeenCalledWith(
			expect.any(Object),
			expect.any(Object),
			player,
			GardenAccessMode.FULL
		);
	});

	it("builds a garden-only collector with READ_ONLY access when the player is away with the talisman", async () => {
		player.hasRemoteHarvestTalisman = true;
		vi.mocked(Homes.getOfPlayer).mockResolvedValue({
			id: 1,
			level: 2,
			cityId: "coco",
			getLevel: () => ({
				features: { gardenPlots: 1 }
			})
		} as never);
		vi.mocked(CityDataController.instance.getCityByMapId).mockReturnValue({
			id: "other-city"
		} as never);

		const response: unknown[] = [];
		await new JardinCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response).toHaveLength(1);
		expect(buildGardenData).toHaveBeenCalledWith(
			expect.any(Object),
			expect.any(Object),
			player,
			GardenAccessMode.READ_ONLY
		);
	});
});
