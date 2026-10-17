import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { GardenCommand } from "../../../../src/commands/player/GardenCommand";
import { Homes } from "../../../../src/core/database/game/models/Home";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import { PlayerTalismansManager } from "../../../../src/core/database/game/models/PlayerTalismans";
import { MapLocationDataController } from "../../../../src/data/MapLocation";
import { TravelTime } from "../../../../src/core/maps/TravelTime";
import { BlockingUtils } from "../../../../src/core/utils/BlockingUtils";
import {
	buildGardenData, handleGardenCompostReaction
} from "../../../../src/core/report/ReportGardenService";
import {
	CommandGardenClosedRes, CommandGardenNoAccessRes, GardenNoAccessReason
} from "../../../../../Lib/src/packets/commands/CommandGardenPacket";
import { GardenAccessMode } from "../../../../../Lib/src/types/GardenAccessMode";
import { ReactionCollectorGardenCompostReaction } from "../../../../../Lib/src/packets/interaction/ReactionCollectorCity";

const reactionCollectorMockState = vi.hoisted(() => ({
	endCallback: undefined as ((collector: {
		getFirstReaction: () => {
			reaction: {
				type: string;
				data: unknown;
			};
		} | null;
	}, response: unknown[]) => unknown) | undefined
}));

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
vi.mock("../../../../src/core/database/game/models/PlayerTalismans");
vi.mock("../../../../src/data/City");
vi.mock("../../../../src/data/MapLocation");
vi.mock("../../../../src/core/maps/TravelTime");
vi.mock("../../../../src/core/utils/BlockingUtils");
vi.mock("../../../../src/core/report/ReportGardenService", () => ({
	buildGardenData: vi.fn(),
	handleGardenCompostReaction: vi.fn()
}));
vi.mock("../../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(_collector: unknown, _context: unknown, _options: unknown, endCallback: typeof reactionCollectorMockState.endCallback) {
			reactionCollectorMockState.endCallback = endCallback;
		}

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

describe("GardenCommand", () => {
	const player = {
		id: 42,
		keycloakId: "player-keycloak-id",
		mapLinkId: 3,
		startTravelDate: new Date(0),
		getDestinationId: vi.fn(() => 7),
		getCurrentCityId: vi.fn(() => null as string | null),
		getCumulativeEnergy: vi.fn(() => 100),
		getMaxCumulativeEnergy: vi.fn(() => 200),
		getHealth: vi.fn(() => 50),
		getMaxHealth: vi.fn(() => 100)
	};
	const talismans = { hasRemoteHarvestTalisman: false };
	const context = {};

	beforeEach(() => {
		vi.clearAllMocks();
		reactionCollectorMockState.endCallback = undefined;
		talismans.hasRemoteHarvestTalisman = false;
		player.startTravelDate = new Date(0);
		vi.mocked(PlayerTalismansManager.getOfPlayer).mockResolvedValue(talismans as never);

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
		await new GardenCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response).toHaveLength(1);
		expect(response[0].type).toBe(CommandGardenNoAccessRes.name);
		expect(response[0].data.reason).toBe(GardenNoAccessReason.NO_HOME);
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
		await new GardenCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response[0].data.reason).toBe(GardenNoAccessReason.NO_GARDEN);
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
		player.getCurrentCityId.mockReturnValue("other-city");

		const response: { type: string; data: { reason: string } }[] = [];
		await new GardenCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response[0].data.reason).toBe(GardenNoAccessReason.NO_TALISMAN);
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
		player.getCurrentCityId.mockReturnValue("coco");

		const response: unknown[] = [];
		await new GardenCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response).toHaveLength(1);
		expect(buildGardenData).toHaveBeenCalledWith(
			expect.any(Object),
			expect.any(Object),
			player,
			GardenAccessMode.FULL
		);
	});

	it("refuses full access while the player is travelling to their home city", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue({
			id: 1,
			level: 2,
			cityId: "coco",
			getLevel: () => ({
				features: { gardenPlots: 1 }
			})
		} as never);
		player.getCurrentCityId.mockReturnValue("coco");
		player.startTravelDate = new Date();

		const response: { type: string; data: { reason: string } }[] = [];
		await new GardenCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response[0].data.reason).toBe(GardenNoAccessReason.NO_TALISMAN);
		expect(buildGardenData).not.toHaveBeenCalled();
	});

	it("builds a garden-only collector with READ_ONLY access when the player is away with the talisman", async () => {
		talismans.hasRemoteHarvestTalisman = true;
		vi.mocked(Homes.getOfPlayer).mockResolvedValue({
			id: 1,
			level: 2,
			cityId: "coco",
			getLevel: () => ({
				features: { gardenPlots: 1 }
			})
		} as never);
		player.getCurrentCityId.mockReturnValue("other-city");

		const response: unknown[] = [];
		await new GardenCommand().execute(response as never, player as never, {} as never, context as never);

		expect(response).toHaveLength(1);
		expect(buildGardenData).toHaveBeenCalledWith(
			expect.any(Object),
			expect.any(Object),
			player,
			GardenAccessMode.READ_ONLY
		);
	});

	it("handles compost reactions from the garden-only collector", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue({
			id: 1,
			level: 2,
			cityId: "coco",
			getLevel: () => ({
				features: { gardenPlots: 1 }
			})
		} as never);
		player.getCurrentCityId.mockReturnValue("coco");

		await new GardenCommand().execute([] as never, player as never, {} as never, context as never);

		const response: unknown[] = [];
		await reactionCollectorMockState.endCallback!(
			{
				getFirstReaction: () => ({
					reaction: {
						type: ReactionCollectorGardenCompostReaction.name,
						data: {
							plantId: 1,
							quantity: 1
						}
					}
				})
			},
			response
		);

		expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(
			player.keycloakId,
			expect.any(String)
		);
		expect(handleGardenCompostReaction).toHaveBeenCalledWith(player, 1, 1, response);
		expect(response).not.toContainEqual(expect.objectContaining({ type: CommandGardenClosedRes.name }));
	});
});
