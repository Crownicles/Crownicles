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
	CommandReportGardenWaterReq,
	CommandReportGardenWaterRes,
	CommandReportGardenErrorRes,
	CommandReportGardenCompostRes,
	CommandReportGardenCompostNotEnoughPlantsRes,
	CommandReportPlantTransferReq,
	CommandReportPlantTransferRes,
	PlantTransferError,
	GardenError
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import HomeGardenSlot, { HomeGardenSlots } from "../database/game/models/HomeGardenSlot";
import { HomePlantStorages } from "../database/game/models/HomePlantStorage";
import PlayerPlantSlot, { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import {
	PlantConstants, PlantId
} from "../../../../Lib/src/constants/PlantConstants";
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Materials } from "../database/game/models/Material";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import { GardenAccessMode } from "../../../../Lib/src/types/GardenAccessMode";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { crowniclesInstance } from "../../app";
import { MissionsController } from "../missions/MissionsController";
import { GardenActionType } from "../database/logs/LogsCityLogger";

type HomeData = ReactionCollectorCityData["home"];
type GardenData = NonNullable<NonNullable<HomeData["owned"]>["garden"]>;
type GardenWaterContext = {
	player: Player;
	home: Home;
	homeLevel: HomeLevel;
};
type GardenWateringResult = {
	entries: WaterableSlotGrowth[];
	slotsBecameReady: number;
};
type WaterableSlotGrowth = {
	slot: number;
	plantId: number;
	becomesReady: boolean;
};

/**
 * Compute the unix-ms timestamp at which the player can next water their garden,
 * or null when watering is currently available (never watered, or cooldown elapsed).
 */
function computeNextWateringAvailableAt(lastGardenWatered: Date | null, now = Date.now()): number | null {
	if (!lastGardenWatered) {
		return null;
	}
	const next = lastGardenWatered.valueOf() + GardenConstants.WATERING_COOLDOWN_MS;
	return next > now ? next : null;
}

function makeGardenErrorPacket(error: GardenError, availableAt?: number): CrowniclesPacket {
	const availableAtData = availableAt === undefined ? {} : { availableAt };
	return makePacket(CommandReportGardenErrorRes, {
		error,
		...availableAtData
	});
}

/**
 * Resolve `(player, home)` for a Discord interaction and run `body` under a
 * composite Player + Home row-level lock. When the player or home cannot be
 * found, `onMissing()` is returned without acquiring any lock.
 *
 * Use this helper for every garden mutation: it ensures concurrent shards
 * cannot double-mutate the same garden / inventory pair (review checklist §10).
 */
async function withGardenLock(
	keycloakId: string,
	onMissing: () => CrowniclesPacket,
	body: (player: Player, home: Home) => Promise<CrowniclesPacket>
): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;

	if (!player || !home) {
		return onMissing();
	}

	return await withLockedEntities(
		[Player.lockKey(player.id), Home.lockKey(home.id)] as const,
		([lockedPlayer, lockedHome]) => body(lockedPlayer, lockedHome)
	);
}

export async function buildGardenData(
	home: Home,
	homeLevel: HomeLevel,
	player: Player,
	accessMode: GardenAccessMode = GardenAccessMode.FULL
): Promise<GardenData> {
	const gardenPlots = homeLevel.features.gardenPlots;
	const earthQuality = homeLevel.features.gardenEarthQuality;

	await HomeGardenSlots.ensureSlotsForLevel(home.id, gardenPlots);
	await HomePlantStorages.initializeStorage(home.id);

	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const plots = buildGardenPlotsData(gardenSlots, earthQuality);

	const storageEntries = await HomePlantStorages.getOfHome(home.id);
	const maxCapacity = homeLevel.features.gardenPlantStorageCapacity;
	const plantStorage: GardenData["plantStorage"] = storageEntries.map(entry => ({
		plantId: entry.plantId,
		quantity: entry.quantity,
		maxCapacity
	}));

	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	await PlayerPlantSlots.initializeSlots(player.id, invInfo.plantSlots);
	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	const hasSeed = seedSlot !== null && seedSlot.plantId !== 0;

	const wateringAvailableAt = computeNextWateringAvailableAt(player.lastGardenWatered);
	const eligibility = computeGardenEligibility({
		accessMode, plots, plantStorage, hasSeed, wateringAvailableAt
	});

	return {
		plots,
		plantStorage,
		hasSeed,
		seedPlantId: seedSlot?.plantId ?? 0,
		totalPlots: gardenPlots,
		accessMode,
		wateringAvailableAt,
		eligibility
	};
}

function computeGardenEligibility(params: {
	accessMode: GardenAccessMode;
	plots: GardenData["plots"];
	plantStorage: GardenData["plantStorage"];
	hasSeed: boolean;
	wateringAvailableAt: number | null;
}): GardenData["eligibility"] {
	const {
		accessMode, plots, plantStorage, hasSeed, wateringAvailableAt
	} = params;
	const isReadOnly = accessMode === GardenAccessMode.READ_ONLY;
	const canHarvest = plots.some(plot => plot.isReady);
	const canPlantSeed = !isReadOnly && hasSeed && plots.some(plot => plot.plantId === 0);
	const hasGrowingPlants = plots.some(plot => plot.plantId !== 0 && !plot.isReady);
	const wateringAvailable = wateringAvailableAt === null || wateringAvailableAt <= Date.now();
	const canWaterGarden = !isReadOnly && hasGrowingPlants && wateringAvailable;
	const canCompost = !isReadOnly && plantStorage.some(entry => entry.quantity > 0);
	return {
		canHarvest, canPlantSeed, canWaterGarden, canCompost
	};
}

function buildGardenPlotsData(gardenSlots: HomeGardenSlot[], earthQuality: number): GardenData["plots"] {
	return gardenSlots.map(slot => {
		const plant = PlantConstants.getPlantById(slot.plantId);
		const effectiveGrowthTime = plant
			? GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality)
			: 0;
		const isReady = slot.isReady(effectiveGrowthTime);
		const progress = slot.getGrowthProgress(effectiveGrowthTime);
		const readyAtTimestamp = plant
			? computeReadyAtTimestamp(slot, effectiveGrowthTime, isReady)
			: 0;

		return {
			slot: slot.slot,
			plantId: slot.plantId,
			growthProgress: progress,
			isReady,
			readyAtTimestamp
		};
	});
}

function computeReadyAtTimestamp(slot: HomeGardenSlot, effectiveGrowthTime: number, isReady: boolean): number {
	if (!slot.plantedAt) {
		return 0;
	}
	if (isReady) {
		return 0;
	}

	return Math.ceil((slot.plantedAt.valueOf() + effectiveGrowthTime * TimeConstants.MS_TIME.SECOND) / TimeConstants.MS_TIME.SECOND);
}

/**
 * Handle garden harvest — collect all ready plants from the garden.
 * Runs under a composite Player + Home lock so concurrent shards cannot
 * double-harvest the same ready slot (race-safe, see review checklist §10).
 */
export function handleGardenHarvest(
	keycloakId: string,
	_packet: CommandReportGardenHarvestReq,
	response: CrowniclesPacket[]
): Promise<CrowniclesPacket> {
	return withGardenLock(
		keycloakId,
		() => makeGardenErrorPacket(GardenConstants.GARDEN_ERRORS.NO_READY_PLANTS),
		(player, home) => {
			const homeLevel = home.getLevel();
			if (!homeLevel) {
				return Promise.resolve(makeGardenErrorPacket(GardenConstants.GARDEN_ERRORS.NO_READY_PLANTS));
			}
			return runHarvestUnderLock({
				player, home, homeLevel, response
			});
		}
	);
}

async function runHarvestUnderLock(params: {
	player: Player;
	home: Home;
	homeLevel: HomeLevel;
	response: CrowniclesPacket[];
}): Promise<CrowniclesPacket> {
	const {
		player, home, homeLevel, response
	} = params;
	const earthQuality = homeLevel.features.gardenEarthQuality;
	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const maxCapacity = homeLevel.features.gardenPlantStorageCapacity;

	let plantsHarvested = 0;
	const compostResults: {
		plantId: PlantId; materialId: number;
	}[] = [];
	const harvestedSlots: number[] = [];

	for (const slot of gardenSlots) {
		plantsHarvested += await processHarvestSlotUnderLock({
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

	if (harvestedSlots.length > 0 || compostResults.length > 0) {
		crowniclesInstance?.logsDatabase.logGardenAction({
			keycloakId: player.keycloakId,
			cityId: player.getCurrentCityId(),
			action: GardenActionType.HARVEST,
			plantId: "",
			slot: 0,
			cost: 0,
			quantity: plantsHarvested + compostResults.length
		}).then();
	}

	if (plantsHarvested > 0) {
		await MissionsController.update(player, response, {
			missionId: "cultivatePlants",
			count: plantsHarvested
		});
	}

	return makePacket(CommandReportGardenHarvestRes, {
		plantsHarvested,
		plantsComposted: compostResults.length,
		compostResults,
		plantStorage,
		harvestedSlots
	});
}

async function processHarvestSlotUnderLock(params: {
	slot: HomeGardenSlot;
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
		const materialId = await pickAndGiveCompostMaterial(playerId, plant);
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
 * Pick a random material from the plant's compost pool and grant it to the player.
 * Shared between the harvest-overflow auto-compost and the manual compost flow.
 */
async function pickAndGiveCompostMaterial(playerId: number, plant: { compostMaterials: number[] }): Promise<number> {
	const materialId = RandomUtils.crowniclesRandom.pick(plant.compostMaterials);
	await Materials.giveMaterial(playerId, materialId, 1);
	return materialId;
}

/**
 * Handle garden plant — plant a seed in a specific garden plot.
 * Runs under a composite Player + Home lock to prevent concurrent planting
 * from consuming the same seed twice or claiming the same empty plot.
 */
export function handleGardenPlant(
	keycloakId: string,
	packet: CommandReportGardenPlantReq
): Promise<CrowniclesPacket> {
	return withGardenLock(
		keycloakId,
		() => makeGardenErrorPacket(GardenConstants.GARDEN_ERRORS.NO_SEED),
		(player, home) => runGardenPlantUnderLock(player, home, packet)
	);
}

async function runGardenPlantUnderLock(
	player: Player,
	home: Home,
	packet: CommandReportGardenPlantReq
): Promise<CrowniclesPacket> {
	const validation = await validateGardenPlant(player, home, packet);
	if (validation.error) {
		return makeGardenErrorPacket(validation.error);
	}

	const {
		seedSlot, gardenSlot
	} = validation;
	const plantId = seedSlot!.plantId;

	await HomeGardenSlots.plantSeed(home.id, gardenSlot!.slot, plantId);
	await PlayerPlantSlots.clearSeed(player.id);

	crowniclesInstance?.logsDatabase.logGardenAction({
		keycloakId: player.keycloakId,
		cityId: player.getCurrentCityId(),
		action: GardenActionType.PLANT,
		plantId: String(plantId),
		slot: gardenSlot!.slot,
		cost: 0
	}).then();

	return makePacket(CommandReportGardenPlantRes, {
		plantId,
		gardenSlot: gardenSlot!.slot
	});
}

type GardenPlantValidation = {
	error?: GardenError;
	seedSlot?: PlayerPlantSlot;
	gardenSlot?: HomeGardenSlot;
};

async function validateGardenPlant(
	player: Player,
	home: Home,
	packet: CommandReportGardenPlantReq
): Promise<GardenPlantValidation> {
	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	if (!seedSlot || seedSlot.plantId === 0) {
		return { error: GardenConstants.GARDEN_ERRORS.NO_SEED };
	}

	const gardenSlot = await resolveGardenSlot(home, packet.gardenSlot);
	if (!gardenSlot || !gardenSlot.isEmpty()) {
		return { error: GardenConstants.GARDEN_ERRORS.NO_EMPTY_PLOT };
	}

	const alreadyPlanted = await isPlantAlreadyInGarden(home, seedSlot.plantId);
	if (alreadyPlanted) {
		return { error: GardenConstants.GARDEN_ERRORS.SEED_ALREADY_PLANTED };
	}

	return {
		seedSlot, gardenSlot
	};
}

async function resolveGardenSlot(home: Home, gardenSlot: number): Promise<HomeGardenSlot | null> {
	return gardenSlot === -1
		? await HomeGardenSlots.findEmptySlot(home.id)
		: await HomeGardenSlots.getSlot(home.id, gardenSlot);
}

async function isPlantAlreadyInGarden(home: Home, plantId: PlantId | 0): Promise<boolean> {
	const allGardenSlots = await HomeGardenSlots.getOfHome(home.id);
	return allGardenSlots.some(s => s.plantId === plantId);
}

/**
 * Build refreshed plant transfer data (storage + player slots) for response.
 */
async function buildPlantTransferResponseData(params: {
	home: Home;
	player: Player;
	maxCapacity: number;
}): Promise<{
	plantStorage: CommandReportPlantTransferRes["plantStorage"];
	playerPlantSlots: CommandReportPlantTransferRes["playerPlantSlots"];
}> {
	const homeStorage = await HomePlantStorages.getOfHome(params.home.id);
	const plantSlots = await PlayerPlantSlots.getPlantSlots(params.player.id);

	return {
		plantStorage: homeStorage
			.filter(s => s.quantity > 0)
			.map(s => ({
				plantId: s.plantId,
				quantity: s.quantity,
				maxCapacity: params.maxCapacity
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
function makeTransferErrorPacket(error: PlantTransferError): CrowniclesPacket {
	return makePacket(CommandReportPlantTransferRes, {
		success: false,
		error,
		plantStorage: [],
		playerPlantSlots: []
	});
}

function executeTransferAction(packet: CommandReportPlantTransferReq, player: Player, home: Home): Promise<PlantTransferError | null> {
	if (packet.action === HomeConstants.PLANT_TRANSFER_ACTIONS.DEPOSIT) {
		return handlePlantDeposit({
			player,
			home,
			playerSlot: packet.playerSlot
		});
	}
	if (packet.action === HomeConstants.PLANT_TRANSFER_ACTIONS.WITHDRAW) {
		return handlePlantWithdraw({
			player,
			home,
			plantId: packet.plantId
		});
	}
	return Promise.resolve(HomeConstants.PLANT_TRANSFER_ERRORS.INVALID);
}

export function handlePlantTransfer(
	keycloakId: string,
	packet: CommandReportPlantTransferReq
): Promise<CrowniclesPacket> {
	return withGardenLock(
		keycloakId,
		() => makeTransferErrorPacket(HomeConstants.PLANT_TRANSFER_ERRORS.INVALID),
		(player, home) => runPlantTransferUnderLock(player, home, packet)
	);
}

async function runPlantTransferUnderLock(
	player: Player,
	home: Home,
	packet: CommandReportPlantTransferReq
): Promise<CrowniclesPacket> {
	const error = await executeTransferAction(packet, player, home);

	if (error) {
		return makeTransferErrorPacket(error);
	}

	const refreshedData = await buildPlantTransferResponseData({
		home, player, maxCapacity: home.getLevel()!.features.gardenPlantStorageCapacity
	});

	return makePacket(CommandReportPlantTransferRes, {
		success: true,
		...refreshedData
	});
}

async function handlePlantDeposit(params: {
	player: Player;
	home: Home;
	playerSlot: number;
}): Promise<PlantTransferError | null> {
	const plantSlots = await PlayerPlantSlots.getPlantSlots(params.player.id);
	const sourceSlot = plantSlots.find(s => s.slot === params.playerSlot);

	if (!sourceSlot || sourceSlot.plantId === 0) {
		return HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND;
	}

	const maxCapacity = params.home.getLevel()!.features.gardenPlantStorageCapacity;
	const overflow = await HomePlantStorages.addPlant(params.home.id, sourceSlot.plantId, 1, maxCapacity);
	if (overflow > 0) {
		return HomeConstants.PLANT_TRANSFER_ERRORS.STORAGE_FULL;
	}

	await PlayerPlantSlots.clearPlant(params.player.id, params.playerSlot);
	return null;
}

async function handlePlantWithdraw(params: {
	player: Player;
	home: Home;
	plantId: PlantId | 0;
}): Promise<PlantTransferError | null> {
	const storageEntry = await HomePlantStorages.getForPlant(params.home.id, params.plantId);
	if (!storageEntry || storageEntry.quantity <= 0) {
		return HomeConstants.PLANT_TRANSFER_ERRORS.NOT_FOUND;
	}

	const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(params.player.id);
	if (!emptySlot) {
		return HomeConstants.PLANT_TRANSFER_ERRORS.NO_EMPTY_SLOT;
	}

	await HomePlantStorages.removePlant(params.home.id, params.plantId);
	await PlayerPlantSlots.setPlant(params.player.id, emptySlot.slot, params.plantId);
	return null;
}

/**
 * Handle garden watering — instantly advance the growth of every currently
 * growing plant by its own `wateringAdvanceSeconds` (see `PlantConstants`).
 * Plants whose `wateringAdvanceSeconds` is `0` (typically the fastest ones)
 * are ignored. A 12h cooldown is enforced
 * via `Player.lastGardenWatered`. Only allowed when the player is at home
 * (this entry point is invoked from the home-menu collector, which itself is
 * only opened when the player is in their home city).
 */
export async function handleGardenWater(
	keycloakId: string,
	_packet: CommandReportGardenWaterReq
): Promise<CrowniclesPacket> {
	const waterContext = await getGardenWaterContext(keycloakId);
	if (!waterContext) {
		return makeGardenErrorPacket(GardenConstants.GARDEN_ERRORS.NO_PLANTS_TO_WATER);
	}

	return await withLockedEntities(
		[Player.lockKey(waterContext.player.id), Home.lockKey(waterContext.home.id)] as const,
		([lockedPlayer, lockedHome]) => waterGardenForLockedPlayerUnderLock({
			lockedPlayer,
			home: lockedHome,
			homeLevel: waterContext.homeLevel,
			now: Date.now()
		})
	);
}

async function getGardenWaterContext(keycloakId: string): Promise<GardenWaterContext | null> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player) {
		return null;
	}

	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		return null;
	}

	const homeLevel = home.getLevel();
	if (!homeLevel) {
		return null;
	}

	return homeLevel.features.gardenPlots > 0
		? {
			player,
			home,
			homeLevel
		}
		: null;
}

async function waterGardenForLockedPlayerUnderLock(params: {
	lockedPlayer: Player;
	home: Home;
	homeLevel: HomeLevel;
	now: number;
}): Promise<CrowniclesPacket> {
	const nextAvailableAt = computeNextWateringAvailableAt(params.lockedPlayer.lastGardenWatered, params.now);
	if (nextAvailableAt !== null) {
		return makeGardenErrorPacket(GardenConstants.GARDEN_ERRORS.WATERING_ON_COOLDOWN, nextAvailableAt);
	}

	const wateringResult = await getGardenWateringResult(params.home, params.homeLevel, params.now);
	if (wateringResult.entries.length === 0) {
		return makeGardenErrorPacket(GardenConstants.GARDEN_ERRORS.NO_PLANTS_TO_WATER);
	}

	await applyGardenWateringUnderLock(params.lockedPlayer, params.home, wateringResult, params.now);

	crowniclesInstance?.logsDatabase.logGardenAction({
		keycloakId: params.lockedPlayer.keycloakId,
		cityId: params.lockedPlayer.getCurrentCityId(),
		action: GardenActionType.WATER,
		plantId: "",
		slot: 0,
		cost: 0,
		quantity: wateringResult.entries.length
	}).then();

	return makePacket(CommandReportGardenWaterRes, {
		slotsWatered: wateringResult.entries.length,
		slotsBecameReady: wateringResult.slotsBecameReady,
		nextWateringAvailableAt: params.now + GardenConstants.WATERING_COOLDOWN_MS
	});
}

async function getGardenWateringResult(home: Home, homeLevel: HomeLevel, now: number): Promise<GardenWateringResult> {
	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);
	return collectSlotsToWater(gardenSlots, homeLevel.features.gardenEarthQuality, now);
}

async function applyGardenWateringUnderLock(
	lockedPlayer: Player,
	home: Home,
	wateringResult: GardenWateringResult,
	now: number
): Promise<void> {
	const slotsByPlantId = groupSlotsByPlantId(wateringResult.entries);
	await shiftPlantedAtForGroupedSlots(home.id, slotsByPlantId);

	lockedPlayer.lastGardenWatered = new Date(now);
	await lockedPlayer.save();
}

function groupSlotsByPlantId(entries: WaterableSlotGrowth[]): Map<number, number[]> {
	const grouped = new Map<number, number[]>();
	for (const entry of entries) {
		const slots = grouped.get(entry.plantId);
		if (slots) {
			slots.push(entry.slot);
		}
		else {
			grouped.set(entry.plantId, [entry.slot]);
		}
	}
	return grouped;
}

async function shiftPlantedAtForGroupedSlots(homeId: number, slotsByPlantId: Map<number, number[]>): Promise<void> {
	for (const [plantId, slots] of slotsByPlantId) {
		const plant = PlantConstants.getPlantById(plantId);
		if (!plant || plant.wateringAdvanceSeconds <= 0) {
			continue;
		}
		await HomeGardenSlots.shiftPlantedAtForSlots(
			homeId,
			slots,
			plant.wateringAdvanceSeconds * TimeConstants.MS_TIME.SECOND
		);
	}
}

/**
 * Determine which slots are currently growing (non-empty, planted, not yet
 * ready) and count how many of them would become ready after applying the
 * watering time advance.
 */
function collectSlotsToWater(
	gardenSlots: HomeGardenSlot[],
	earthQuality: number,
	nowMs: number
): GardenWateringResult {
	const waterableSlots = gardenSlots
		.map(slot => getWaterableSlotGrowth(slot, earthQuality, nowMs))
		.filter((slot): slot is WaterableSlotGrowth => slot !== null);

	return {
		entries: waterableSlots,
		slotsBecameReady: waterableSlots.filter(slot => slot.becomesReady).length
	};
}

function getWaterableSlotGrowth(
	slot: HomeGardenSlot,
	earthQuality: number,
	nowMs: number
): WaterableSlotGrowth | null {
	if (slot.isEmpty()) {
		return null;
	}
	if (!slot.plantedAt) {
		return null;
	}

	const plant = PlantConstants.getPlantById(slot.plantId);
	if (!plant) {
		return null;
	}

	if (plant.wateringAdvanceSeconds <= 0) {
		return null;
	}

	const effectiveGrowthTime = GardenConstants.getEffectiveGrowthTime(plant.growthTimeSeconds, earthQuality);
	if (slot.isReady(effectiveGrowthTime)) {
		return null;
	}

	return {
		slot: slot.slot,
		plantId: slot.plantId,
		becomesReady: willBecomeReadyAfterWatering(slot.plantedAt, effectiveGrowthTime, plant.wateringAdvanceSeconds, nowMs)
	};
}

function willBecomeReadyAfterWatering(plantedAt: Date, effectiveGrowthTime: number, wateringAdvanceSeconds: number, nowMs: number): boolean {
	const elapsedSeconds = (nowMs - plantedAt.valueOf()) / TimeConstants.MS_TIME.SECOND;
	return elapsedSeconds + wateringAdvanceSeconds >= effectiveGrowthTime;
}

/**
 * Handle a manual compost reaction triggered from the home garden sub-menu of `/rapport`.
 * The whole flow (validation + storage decrement + material grant) runs under a
 * composite lock on Home + Player so concurrent shards cannot double-compost
 * the same plants (race-safe, see review checklist §10).
 *
 * This terminates the `/rapport` command — the city collector end callback is
 * the one calling us, mirroring the shop purchase / inn meal flow.
 */
export async function handleGardenCompostReaction(
	player: Player,
	plantId: PlantId,
	quantity: number,
	response: CrowniclesPacket[]
): Promise<void> {
	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		response.push(makePacket(CommandReportGardenCompostNotEnoughPlantsRes, {
			plantId, quantity
		}));
		return;
	}

	const plant = PlantConstants.getPlantById(plantId);
	if (!plant) {
		response.push(makePacket(CommandReportGardenCompostNotEnoughPlantsRes, {
			plantId, quantity
		}));
		return;
	}

	await Home.withLocked(home.id, async (): Promise<void> => {
		const removed = await HomePlantStorages.removePlantsUnderLock(home.id, plantId, quantity);
		if (!removed) {
			response.push(makePacket(CommandReportGardenCompostNotEnoughPlantsRes, {
				plantId, quantity
			}));
			return;
		}

		const materials: number[] = [];
		for (let i = 0; i < quantity; i++) {
			const materialId = await pickAndGiveCompostMaterial(player.id, plant);
			materials.push(materialId);
		}

		response.push(makePacket(CommandReportGardenCompostRes, {
			plantId,
			quantity,
			materials
		}));

		crowniclesInstance?.logsDatabase.logGardenAction({
			keycloakId: player.keycloakId,
			cityId: player.getCurrentCityId(),
			action: GardenActionType.COMPOST,
			plantId: String(plantId),
			slot: 0,
			cost: 0,
			quantity
		}).then();
	});
}
