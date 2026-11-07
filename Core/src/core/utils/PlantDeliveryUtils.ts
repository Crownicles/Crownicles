import { Player } from "../database/game/models/Player";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomePlantStorages } from "../database/game/models/HomePlantStorage";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import {
	PLANT_RECEPTION_FAILURES, PlantConstants, PlantId, PlantReceptionFailure
} from "../../../../Lib/src/constants/PlantConstants";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { withLockedPlayerAndMissionsSafe } from "./withLockedPlayerAndMissionsSafe";

/**
 * Home plant storage the plant inventory of a player is magically linked to
 */
type LinkedHomeStorage = {
	homeId: number;
	maxCapacity: number;
};

/**
 * Where the plants received by a player can go, outside of any lock (display purposes only)
 */
export type PlantReception = {
	emptyPlantSlots: number;
	linkedHomeStorage: LinkedHomeStorage | null;
};

/**
 * A player receiving plants, and their home, both locked
 */
export type PlantReceiver = {
	player: Locked<Player>;
	home: Locked<Home> | null;
};

export type PlantDeliveryRequest = {
	plantId: PlantId;
	amount: number;
};

export type PlantDeliveryResult =
	| {
		delivered: true;
		toHomeStorage: number;
		toPlantSlots: number;
	}
	| {
		delivered: false;
		reason: PlantReceptionFailure;
	};

const DELIVERY_LOCK_CONTEXT = "givePlantsToPlayer";

function getLinkedHomeStorage(plantSlots: number, home: Home | null): LinkedHomeStorage | null {
	if (!home || !PlantConstants.hasHomeStorageLink(plantSlots)) {
		return null;
	}
	const homeLevel = home.getLevel();
	return homeLevel
		? {
			homeId: home.id,
			maxCapacity: homeLevel.features.gardenPlantStorageCapacity
		}
		: null;
}

/**
 * Whether the plant inventory of a player is linked to their home plant storage: it needs the last tanner
 * plant slot upgrade and a home
 */
export function isPlantInventoryLinkedToHome(plantSlots: number, home: Home | null): boolean {
	return getLinkedHomeStorage(plantSlots, home) !== null;
}

function getHomeStorageRoom(linkedHomeStorage: LinkedHomeStorage | null, plantId: PlantId): Promise<number> {
	return linkedHomeStorage
		? HomePlantStorages.getRoomFor(linkedHomeStorage.homeId, plantId, linkedHomeStorage.maxCapacity)
		: Promise.resolve(0);
}

function getReceptionFailure(linkedHomeStorage: LinkedHomeStorage | null, home: Home | null): PlantReceptionFailure {
	if (linkedHomeStorage) {
		return PLANT_RECEPTION_FAILURES.HOME_STORAGE_FULL;
	}
	return home ? PLANT_RECEPTION_FAILURES.PLANT_SLOTS_FULL : PLANT_RECEPTION_FAILURES.NO_HOME;
}

export async function getPlantReception(playerId: number): Promise<PlantReception> {
	const [
		invInfo,
		home,
		plantSlots
	] = await Promise.all([
		InventoryInfos.getOfPlayer(playerId),
		Homes.getOfPlayer(playerId),
		PlayerPlantSlots.getPlantSlots(playerId)
	]);

	// Plant slot rows are created lazily, a missing row is an empty slot
	const occupiedPlantSlots = plantSlots.filter(slot => !slot.isEmpty()).length;
	return {
		emptyPlantSlots: Math.max(0, invInfo.plantSlots - occupiedPlantSlots),
		linkedHomeStorage: getLinkedHomeStorage(invInfo.plantSlots, home)
	};
}

/**
 * Largest quantity of a plant type the player can receive: their empty plant slots, plus the room left for
 * this plant in the linked home storage
 */
export async function getPlantReceptionCapacity(reception: PlantReception, plantId: PlantId): Promise<number> {
	return reception.emptyPlantSlots + await getHomeStorageRoom(reception.linkedHomeStorage, plantId);
}

/**
 * Lock the player, their missions and their home (if any) in the canonical order, so that a plant delivery and
 * the player mutations around it (money, missions) form a single critical section.
 *
 * Reentrant, but a caller already inside a critical section must already hold the home lock too (small events
 * declare it with `getAdditionalLockKeys`): otherwise the home row would be locked after the player row, against
 * the canonical order.
 */
export async function withLockedPlantReceiver(player: Player, context: string, body: (receiver: PlantReceiver) => Promise<void>): Promise<void> {
	const home = await Homes.getOfPlayer(player.id);
	await withLockedPlayerAndMissionsSafe(player, context, async lockedPlayer => {
		await body({
			player: lockedPlayer,
			home: home ? await Home.findByPk(home.id) : null
		});
	}, home ? [Home.lockKey(home.id)] : []);
}

/**
 * Give plants to a player, all or nothing. When the plant inventory is linked to the home, the plants go to the
 * home plant storage first and the plant slots only take what the chest cannot hold. Otherwise, they go to the
 * plant slots. The receiver must come from {@link withLockedPlantReceiver}, so that concurrent deliveries can
 * neither claim the same empty slot nor overfill the chest.
 */
export async function givePlantsUnderLock(receiver: PlantReceiver, request: PlantDeliveryRequest): Promise<PlantDeliveryResult> {
	const {
		player, home
	} = receiver;
	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	await PlayerPlantSlots.initializeSlots(player.id, invInfo.plantSlots);
	const linkedHomeStorage = getLinkedHomeStorage(invInfo.plantSlots, home);
	const emptySlots = (await PlayerPlantSlots.getPlantSlots(player.id)).filter(slot => slot.isEmpty());

	const toHomeStorage = Math.min(request.amount, await getHomeStorageRoom(linkedHomeStorage, request.plantId));
	const toPlantSlots = request.amount - toHomeStorage;
	if (toPlantSlots > emptySlots.length) {
		return {
			delivered: false,
			reason: getReceptionFailure(linkedHomeStorage, home)
		};
	}

	if (linkedHomeStorage && toHomeStorage > 0) {
		await HomePlantStorages.addPlant(linkedHomeStorage.homeId, request.plantId, toHomeStorage, linkedHomeStorage.maxCapacity);
	}
	for (const slot of emptySlots.slice(0, toPlantSlots)) {
		await PlayerPlantSlots.setPlant(player.id, slot.slot, request.plantId);
	}
	return {
		delivered: true,
		toHomeStorage,
		toPlantSlots
	};
}

/**
 * Lock the player and their home, then give them plants: see {@link givePlantsUnderLock}
 */
export async function givePlantsToPlayer(player: Player, request: PlantDeliveryRequest): Promise<PlantDeliveryResult> {
	let result: PlantDeliveryResult = {
		delivered: false,
		reason: PLANT_RECEPTION_FAILURES.NO_HOME
	};
	await withLockedPlantReceiver(player, DELIVERY_LOCK_CONTEXT, async receiver => {
		result = await givePlantsUnderLock(receiver, request);
	});
	return result;
}
