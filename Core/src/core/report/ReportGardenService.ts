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
	CommandReportGardenPlantErrorRes,
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

type HomeData = ReactionCollectorCityData["home"];
type GardenData = NonNullable<NonNullable<HomeData["owned"]>["garden"]>;

export async function buildGardenData(
	home: Home,
	homeLevel: HomeLevel,
	player: Player
): Promise<GardenData> {
	const gardenPlots = homeLevel.features.gardenPlots;
	const earthQuality = homeLevel.features.gardenEarthQuality;

	// Ensure garden slots exist
	await HomeGardenSlots.ensureSlotsForLevel(home.id, gardenPlots);

	// Ensure plant storage exists
	await HomePlantStorages.initializeStorage(home.id);

	// Load garden slots
	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);

	// Build plot status
	const plots: GardenData["plots"] = gardenSlots.map(slot => {
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

	// Build plant storage data
	const storageEntries = await HomePlantStorages.getOfHome(home.id);
	const maxCapacity = home.level;
	const plantStorage: GardenData["plantStorage"] = storageEntries.map(entry => ({
		plantId: entry.plantId,
		quantity: entry.quantity,
		maxCapacity
	}));

	// Get player's seed
	await PlayerPlantSlots.initializeSlots(player.id, 1);
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
		return makePacket(CommandReportGardenPlantErrorRes, {
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
		if (slot.isEmpty()) {
			continue;
		}

		const plant = PlantConstants.getPlantById(slot.plantId);
		if (!plant) {
			continue;
		}

		const effectiveGrowthTime = GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality);
		if (!slot.isReady(effectiveGrowthTime)) {
			continue;
		}

		harvestedSlots.push(slot.slot);

		// Try to store the plant in the chest
		const overflow = await HomePlantStorages.addPlant(home.id, slot.plantId, 1, maxCapacity);

		if (overflow > 0) {
			// Plant storage is full — compost the plant into a random material from its set
			const materialId = RandomUtils.crowniclesRandom.pick(plant.compostMaterials);
			await Materials.giveMaterial(player.id, materialId, 1);
			compostResults.push({
				plantId: plant.id,
				materialId
			});
		}
		else {
			plantsHarvested++;
		}

		// Reset the growth timer (plant regrows automatically)
		await HomeGardenSlots.resetGrowthTimer(home.id, slot.slot);
	}

	// Fetch updated plant storage to return to frontend
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

	if (!player || !home || !homeLevel) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.NO_SEED
		});
	}

	// Check if player has a seed
	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	if (!seedSlot || seedSlot.plantId === 0) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.NO_SEED
		});
	}

	// Check if the garden slot is empty (auto-find if -1)
	const gardenSlot = packet.gardenSlot === -1
		? await HomeGardenSlots.findEmptySlot(home.id)
		: await HomeGardenSlots.getSlot(home.id, packet.gardenSlot);

	if (!gardenSlot || !gardenSlot.isEmpty()) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.NO_EMPTY_PLOT
		});
	}

	// Check if the plant type is already planted in another slot
	const allGardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const alreadyPlanted = allGardenSlots.some(s => s.plantId === seedSlot.plantId);
	if (alreadyPlanted) {
		return makePacket(CommandReportGardenPlantErrorRes, {
			error: GardenConstants.GARDEN_ERRORS.SEED_ALREADY_PLANTED
		});
	}

	const plantId = seedSlot.plantId;

	// Plant the seed
	await HomeGardenSlots.plantSeed(home.id, gardenSlot.slot, plantId);

	// Consume the seed
	await PlayerPlantSlots.clearSeed(player.id);

	return makePacket(CommandReportGardenPlantRes, {
		plantId,
		gardenSlot: gardenSlot.slot
	});
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
		const plantSlots = await PlayerPlantSlots.getPlantSlots(player.id);
		const sourceSlot = plantSlots.find(s => s.slot === packet.playerSlot);

		if (!sourceSlot || sourceSlot.plantId === 0) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error: HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND,
				plantStorage: [],
				playerPlantSlots: []
			});
		}

		const overflow = await HomePlantStorages.addPlant(home.id, sourceSlot.plantId, 1, maxCapacity);
		if (overflow > 0) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error: HomeConstants.PLANT_TRANSFER_ERRORS.STORAGE_FULL,
				plantStorage: [],
				playerPlantSlots: []
			});
		}

		await PlayerPlantSlots.clearPlant(player.id, packet.playerSlot);
	}
	else if (packet.action === HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW) {
		const storageEntry = await HomePlantStorages.getForPlant(home.id, packet.plantId);
		if (!storageEntry || storageEntry.quantity <= 0) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error: HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND,
				plantStorage: [],
				playerPlantSlots: []
			});
		}

		const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(player.id);
		if (!emptySlot) {
			return makePacket(CommandReportPlantTransferRes, {
				success: false,
				error: HomeConstants.PLANT_TRANSFER_ERRORS.NO_EMPTY_SLOT,
				plantStorage: [],
				playerPlantSlots: []
			});
		}

		await HomePlantStorages.removePlant(home.id, packet.plantId);
		await PlayerPlantSlots.setPlant(player.id, emptySlot.slot, packet.plantId);
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
