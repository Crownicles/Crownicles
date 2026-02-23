import {
	Player, Players
} from "../database/game/models/Player";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGardenHarvestReq,
	CommandReportGardenHarvestRes,
	CommandReportGardenPlantReq,
	CommandReportGardenPlantRes,
	CommandReportGardenErrorRes,
	CommandReportPlantTransferReq,
	CommandReportPlantTransferRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { HomeGardenSlots } from "../database/game/models/HomeGardenSlot";
import { HomePlantStorages } from "../database/game/models/HomePlantStorage";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import {
	PlantConstants, PlantId
} from "../../../../Lib/src/constants/PlantConstants";
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Materials } from "../database/game/models/Material";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { InventoryInfos } from "../database/game/models/InventoryInfo";

type HomeData = ReactionCollectorCityData["home"];
type GardenData = NonNullable<NonNullable<HomeData["owned"]>["garden"]>;

export async function buildGardenData(
	home: Home,
	homeLevel: HomeLevel,
	player: Player
): Promise<GardenData> {
	const gardenPlots = homeLevel.features.gardenPlots;
	const earthQuality = homeLevel.features.gardenEarthQuality;

	await HomeGardenSlots.ensureSlotsForLevel(home.id, gardenPlots);
	await HomePlantStorages.initializeStorage(home.id);

	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const plots = buildGardenPlotsData(gardenSlots, earthQuality);

	const storageEntries = await HomePlantStorages.getOfHome(home.id);
	const maxCapacity = home.level;
	const plantStorage: GardenData["plantStorage"] = storageEntries.map(entry => ({
		plantId: entry.plantId,
		quantity: entry.quantity,
		maxCapacity
	}));

	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	await PlayerPlantSlots.initializeSlots(player.id, invInfo.plantSlots);
	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	const hasSeed = seedSlot !== null && seedSlot.plantId !== 0;

	return {
		plots,
		plantStorage,
		hasSeed,
		seedPlantId: seedSlot?.plantId ?? 0,
		totalPlots: gardenPlots
	};
}

function buildGardenPlotsData(gardenSlots: HomeGardenSlots[], earthQuality: number): GardenData["plots"] {
	return gardenSlots.map(slot => {
		const plant = PlantConstants.getPlantById(slot.plantId);
		const effectiveGrowthTime = plant
			? GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality)
			: 0;
		const isReady = slot.isReady(effectiveGrowthTime);
		const progress = slot.getGrowthProgress(effectiveGrowthTime);

		let remainingSeconds = 0;
		if (plant && slot.plantedAt && !isReady) {
			const elapsed = (Date.now() - slot.plantedAt.valueOf()) / 1000;
			remainingSeconds = Math.max(0, Math.ceil(effectiveGrowthTime - elapsed));
		}

		return {
			slot: slot.slot,
			plantId: slot.plantId,
			growthProgress: progress,
			isReady,
			remainingSeconds
		};
	});
}

/**
 * Handle garden harvest — collect all ready plants from the garden
 */
export async function handleGardenHarvest(
	keycloakId: string,
	_packet: CommandReportGardenHarvestReq
): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;
	const homeLevel = home?.getLevel();

	if (!player || !home || !homeLevel) {
		return makePacket(CommandReportGardenErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.NO_READY_PLANTS
		});
	}

	const earthQuality = homeLevel.features.gardenEarthQuality;
	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const maxCapacity = home.level;

	let plantsHarvested = 0;
	const compostResults: {
		plantId: PlantId; materialId: number;
	}[] = [];
	const harvestedSlots: number[] = [];

	for (const slot of gardenSlots) {
		plantsHarvested += await processHarvestSlot({
			slot,
			earthQuality,
			homeId: home.id,
			playerId: player.id,
			maxCapacity,
			harvestedSlots,
			compostResults
		});
	}

	const updatedStorage = await HomePlantStorages.getOfHome(home.id);
	const plantStorage = updatedStorage
		.filter(s => s.quantity > 0)
		.map(s => ({
			plantId: s.plantId,
			quantity: s.quantity,
			maxCapacity
		}));

	return makePacket(CommandReportGardenHarvestRes, {
		plantsHarvested,
		plantsComposted: compostResults.length,
		compostResults,
		plantStorage,
		harvestedSlots
	});
}

async function processHarvestSlot(params: {
	slot: HomeGardenSlots;
	earthQuality: number;
	homeId: number;
	playerId: number;
	maxCapacity: number;
	harvestedSlots: number[];
	compostResults: {
		plantId: PlantId; materialId: number;
	}[];
}): Promise<number> {
	const {
		slot, earthQuality, homeId, playerId, maxCapacity, harvestedSlots, compostResults
	} = params;
	if (slot.isEmpty()) {
		return 0;
	}

	const plant = PlantConstants.getPlantById(slot.plantId);
	if (!plant) {
		return 0;
	}

	const effectiveGrowthTime = GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality);
	if (!slot.isReady(effectiveGrowthTime)) {
		return 0;
	}

	harvestedSlots.push(slot.slot);

	const overflow = await HomePlantStorages.addPlant(homeId, slot.plantId, 1, maxCapacity);
	let harvestedCount = 0;

	if (overflow > 0) {
		const materialId = RandomUtils.crowniclesRandom.pick(plant.compostMaterials);
		await Materials.giveMaterial(playerId, materialId, 1);
		compostResults.push({
			plantId: plant.id,
			materialId
		});
	}
	else {
		harvestedCount = 1;
	}

	await HomeGardenSlots.resetGrowthTimer(homeId, slot.slot);
	return harvestedCount;
}

/**
 * Handle garden plant — plant a seed in a specific garden plot
 */
export async function handleGardenPlant(
	keycloakId: string,
	packet: CommandReportGardenPlantReq
): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;
	const homeLevel = home?.getLevel();

	const validation = await validateGardenPlant(player, home, homeLevel, packet);
	if (validation.error) {
		return makePacket(CommandReportGardenErrorRes, {
			error: validation.error
		});
	}

	const {
		seedSlot, gardenSlot
	} = validation;
	const plantId = seedSlot!.plantId;

	await HomeGardenSlots.plantSeed(home!.id, gardenSlot!.slot, plantId);
	await PlayerPlantSlots.clearSeed(player!.id);

	return makePacket(CommandReportGardenPlantRes, {
		plantId,
		gardenSlot: gardenSlot!.slot
	});
}

async function validateGardenPlant(
	player: Player | null,
	home: Home | null,
	homeLevel: HomeLevel | undefined,
	packet: CommandReportGardenPlantReq
): Promise<{
	error?: string; seedSlot?: PlayerPlantSlots; gardenSlot?: HomeGardenSlots;
}> {
	if (!player || !home || !homeLevel) {
		return { error: GardenConstants.GARDEN_ERRORS.NO_SEED };
	}

	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	if (!seedSlot || seedSlot.plantId === 0) {
		return { error: GardenConstants.GARDEN_ERRORS.NO_SEED };
	}

	const gardenSlot = packet.gardenSlot === -1
		? await HomeGardenSlots.findEmptySlot(home.id)
		: await HomeGardenSlots.getSlot(home.id, packet.gardenSlot);

	if (!gardenSlot || !gardenSlot.isEmpty()) {
		return { error: GardenConstants.GARDEN_ERRORS.NO_EMPTY_PLOT };
	}

	const allGardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const alreadyPlanted = allGardenSlots.some(s => s.plantId === seedSlot.plantId);
	if (alreadyPlanted) {
		return { error: GardenConstants.GARDEN_ERRORS.SEED_ALREADY_PLANTED };
	}

	return {
		seedSlot, gardenSlot
	};
}

/**
 * Build refreshed plant transfer data (storage + player slots) for response.
 */
async function buildPlantTransferResponseData(
	homeId: number,
	playerId: number,
	maxCapacity: number
): Promise<{
	plantStorage: CommandReportPlantTransferRes["plantStorage"];
	playerPlantSlots: CommandReportPlantTransferRes["playerPlantSlots"];
}> {
	const homeStorage = await HomePlantStorages.getOfHome(homeId);
	const plantSlots = await PlayerPlantSlots.getPlantSlots(playerId);

	return {
		plantStorage: homeStorage
			.filter(s => s.quantity > 0)
			.map(s => ({
				plantId: s.plantId,
				quantity: s.quantity,
				maxCapacity
			})),
		playerPlantSlots: plantSlots.map(s => ({
			slot: s.slot,
			plantId: s.plantId
		}))
	};
}

/**
 * Handle a plant transfer (deposit/withdraw) between player inventory and home storage.
 */
export async function handlePlantTransfer(
	keycloakId: string,
	packet: CommandReportPlantTransferReq
): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;

	if (!player || !home) {
		return makePacket(CommandReportPlantTransferRes, {
			success: false,
			error: HomeConstants.PLANT_TRANSFER_ERRORS.INVALID,
			plantStorage: [],
			playerPlantSlots: []
		});
	}

	const maxCapacity = home.level;

	if (packet.action === HomeConstants.PLANT_TRANSFER_ACTIONS.DEPOSIT) {
		const error = await handlePlantDeposit(player.id, home.id, packet.playerSlot, maxCapacity);
		if (error) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error,
				plantStorage: [],
				playerPlantSlots: []
			});
		}
	}
	else if (packet.action === HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW) {
		const error = await handlePlantWithdraw(player.id, home.id, packet.plantId);
		if (error) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error,
				plantStorage: [],
				playerPlantSlots: []
			});
		}
	}
	else {
		return makePacket(CommandReportPlantTransferRes, {
			success: false,
			error: HomeConstants.PLANT_TRANSFER_ERRORS.INVALID,
			plantStorage: [],
			playerPlantSlots: []
		});
	}

	const refreshedData = await buildPlantTransferResponseData(home.id, player.id, maxCapacity);

	return makePacket(CommandReportPlantTransferRes, {
		success: true,
		...refreshedData
	});
}

async function handlePlantDeposit(playerId: number, homeId: number, playerSlot: number, maxCapacity: number): Promise<string | null> {
	const plantSlots = await PlayerPlantSlots.getPlantSlots(playerId);
	const sourceSlot = plantSlots.find(s => s.slot === playerSlot);

	if (!sourceSlot || sourceSlot.plantId === 0) {
		return HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND;
	}

	const overflow = await HomePlantStorages.addPlant(homeId, sourceSlot.plantId, 1, maxCapacity);
	if (overflow > 0) {
		return HomeConstants.PLANT_TRANSFER_ERRORS.STORAGE_FULL;
	}

	await PlayerPlantSlots.clearPlant(playerId, playerSlot);
	return null;
}

async function handlePlantWithdraw(playerId: number, homeId: number, plantId: number): Promise<string | null> {
	const storageEntry = await HomePlantStorages.getForPlant(homeId, plantId);
	if (!storageEntry || storageEntry.quantity <= 0) {
		return HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND;
	}

	const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(playerId);
	if (!emptySlot) {
		return HomeConstants.PLANT_TRANSFER_ERRORS.NO_EMPTY_SLOT;
	}

	await HomePlantStorages.removePlant(homeId, plantId);
	await PlayerPlantSlots.setPlant(playerId, emptySlot.slot, plantId);
	return null;
}
