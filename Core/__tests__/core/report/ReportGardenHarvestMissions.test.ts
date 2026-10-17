import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: { logGardenAction: vi.fn().mockResolvedValue(undefined) }
	}
}));

vi.mock("../../../src/core/database/game/models/Player", () => ({
	Player: class {
		static lockKey = vi.fn((id: number) => `players:${id}`);
	},
	Players: { getByKeycloakId: vi.fn() }
}));

vi.mock("../../../src/core/database/game/models/Home", () => ({
	Home: class {
		static lockKey = vi.fn((id: number) => `homes:${id}`);
	},
	Homes: { getOfPlayer: vi.fn() }
}));

vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", () => ({
	default: class {
		static lockKey = vi.fn((id: number) => `player_missions_info:${id}`);
	},
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));

vi.mock("../../../src/core/database/game/models/HomeGardenSlot", () => ({
	default: class {},
	HomeGardenSlots: {
		getOfHome: vi.fn(),
		resetGrowthTimer: vi.fn().mockResolvedValue(undefined)
	}
}));

vi.mock("../../../src/core/database/game/models/HomePlantStorage", () => ({
	HomePlantStorages: {
		getOfHome: vi.fn().mockResolvedValue([]),
		addPlant: vi.fn()
	}
}));

vi.mock("../../../src/core/database/game/models/PlayerPlantSlot", () => ({
	default: class {},
	PlayerPlantSlots: { getOfPlayer: vi.fn() }
}));

vi.mock("../../../src/core/database/game/models/InventoryInfo", () => ({
	InventoryInfos: { getOfPlayer: vi.fn() }
}));

vi.mock("../../../src/core/database/game/models/Material", () => ({
	Materials: { giveMaterial: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({ updateCollectMaterialsMission: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../../Lib/src/locks/withLockedEntities", () => ({
	withLockedEntities: vi.fn()
}));

import { handleGardenHarvest } from "../../../src/core/report/ReportGardenService";
import { Players } from "../../../src/core/database/game/models/Player";
import { Homes } from "../../../src/core/database/game/models/Home";
import { HomeGardenSlots } from "../../../src/core/database/game/models/HomeGardenSlot";
import { HomePlantStorages } from "../../../src/core/database/game/models/HomePlantStorage";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { PlantId } from "../../../../Lib/src/constants/PlantConstants";
import { CommandReportGardenHarvestReq } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";

const HOME_ID = 42;
const READY_SLOT = 0;

function mockedPlayer(): unknown {
	return {
		id: 1,
		keycloakId: "keycloak-id",
		getCurrentCityId: (): string => "city"
	};
}

function mockedHome(): unknown {
	return {
		id: HOME_ID,
		getLevel: (): unknown => ({
			features: {
				gardenEarthQuality: 0,
				gardenPlantStorageCapacity: 4
			}
		})
	};
}

function mockedReadySlot(): unknown {
	return {
		slot: READY_SLOT,
		plantId: PlantId.COMMON_HERB,
		isEmpty: (): boolean => false,
		isReady: (): boolean => true
	};
}

async function harvest(): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await handleGardenHarvest("keycloak-id", new CommandReportGardenHarvestReq(), response);
	return response;
}

describe("handleGardenHarvest missions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(Players.getByKeycloakId).mockResolvedValue(mockedPlayer() as never);
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(mockedHome() as never);
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([mockedReadySlot()] as never);
		vi.mocked(HomeGardenSlots.resetGrowthTimer).mockResolvedValue(undefined as never);
		vi.mocked(HomePlantStorages.getOfHome).mockResolvedValue([] as never);
		vi.mocked(withLockedEntities).mockImplementation((_keys, body) => (body as (entities: unknown[]) => Promise<CrowniclesPacket>)([mockedPlayer(), mockedHome()]) as never);
	});

	it("counts a stored plant for the cultivatePlants mission", async () => {
		vi.mocked(HomePlantStorages.addPlant).mockResolvedValue(0);

		const response = await harvest();

		expect(MissionsController.update).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
			missionId: "cultivatePlants",
			count: 1
		});
		expect(response[0]).toMatchObject({
			plantsHarvested: 1,
			plantsComposted: 0,
			harvestedSlots: [READY_SLOT]
		});
	});

	it("counts an auto-composted plant for the cultivatePlants mission when the storage is full", async () => {
		vi.mocked(HomePlantStorages.addPlant).mockResolvedValue(1);

		const response = await harvest();

		expect(MissionsController.update).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
			missionId: "cultivatePlants",
			count: 1
		});
		expect(response[0]).toMatchObject({
			plantsHarvested: 0,
			plantsComposted: 1,
			harvestedSlots: [READY_SLOT]
		});
	});

	it("does not trigger the cultivatePlants mission when nothing is ready", async () => {
		vi.mocked(HomeGardenSlots.getOfHome).mockResolvedValue([
			{
				slot: READY_SLOT,
				plantId: PlantId.COMMON_HERB,
				isEmpty: (): boolean => false,
				isReady: (): boolean => false
			}
		] as never);
		vi.mocked(HomePlantStorages.addPlant).mockResolvedValue(0);

		await harvest();

		expect(MissionsController.update).not.toHaveBeenCalled();
	});
});
