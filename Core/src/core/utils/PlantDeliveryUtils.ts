import { Player } from "../database/game/models/Player";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomePlantStorages } from "../database/game/models/HomePlantStorage";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import {
	PlantConstants, PlantId
} from "../../../../Lib/src/constants/PlantConstants";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { withLockedEntitiesSafe } from "./withLockedEntitiesSafe";

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

export type PlantDeliveryResult =
	| {
		delivered: true;
		toHomeStorage: number;
		toPlantSlots: number;
	}
	| {
		delivered: false;
		linkedToHomeStorage: boolean;
	};

type PlantDeliveryRequest = {
	playerId: number;
	plantId: PlantId;
	amount: number;
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

async function getHomeStorageRoom(linkedHomeStorage: LinkedHomeStorage | null, plantId: PlantId): Promise<number> {
	if (!linkedHomeStorage) {
		return 0;
	}
	const storage = await HomePlantStorages.getForPlant(linkedHomeStorage.homeId, plantId);
	return Math.max(0, linkedHomeStorage.maxCapacity - (storage?.quantity ?? 0));
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

async function givePlantsUnderLock(request: PlantDeliveryRequest, home: Locked<Home> | null): Promise<PlantDeliveryResult> {
	const {
		playerId, plantId, amount
	} = request;
	const invInfo = await InventoryInfos.getOfPlayer(playerId);
	await PlayerPlantSlots.initializeSlots(playerId, invInfo.plantSlots);
	const linkedHomeStorage = getLinkedHomeStorage(invInfo.plantSlots, home);
	const emptySlots = (await PlayerPlantSlots.getPlantSlots(playerId)).filter(slot => slot.isEmpty());

	const toHomeStorage = Math.min(amount, await getHomeStorageRoom(linkedHomeStorage, plantId));
	const toPlantSlots = amount - toHomeStorage;
	if (toPlantSlots > emptySlots.length) {
		return {
			delivered: false,
			linkedToHomeStorage: linkedHomeStorage !== null
		};
	}

	if (linkedHomeStorage && toHomeStorage > 0) {
		await HomePlantStorages.addPlant(linkedHomeStorage.homeId, plantId, toHomeStorage, linkedHomeStorage.maxCapacity);
	}
	for (const slot of emptySlots.slice(0, toPlantSlots)) {
		await PlayerPlantSlots.setPlant(playerId, slot.slot, plantId);
	}
	return {
		delivered: true,
		toHomeStorage,
		toPlantSlots
	};
}

function withLockedPlayerAndHome(playerId: number, homeId: number | null, body: (home: Locked<Home> | null) => Promise<void>): Promise<boolean> {
	if (homeId === null) {
		return withLockedEntitiesSafe([Player.lockKey(playerId)] as const, DELIVERY_LOCK_CONTEXT, () => body(null));
	}
	return withLockedEntitiesSafe(
		[Player.lockKey(playerId), Home.lockKey(homeId)] as const,
		DELIVERY_LOCK_CONTEXT,
		([, home]) => body(home)
	);
}

/**
 * Give plants to a player, all or nothing. When the plant inventory is linked to the home, the plants go to the
 * home plant storage first and the plant slots only take what the chest cannot hold. Otherwise, they go to the
 * plant slots. Runs under a Player + Home row lock so that concurrent deliveries can neither claim the same empty
 * slot nor overfill the chest. Reentrant: safe to call from a section already holding the player lock.
 */
export async function givePlantsToPlayer(request: PlantDeliveryRequest): Promise<PlantDeliveryResult> {
	const home = await Homes.getOfPlayer(request.playerId);
	let result: PlantDeliveryResult = {
		delivered: false,
		linkedToHomeStorage: false
	};
	await withLockedPlayerAndHome(request.playerId, home?.id ?? null, async lockedHome => {
		result = await givePlantsUnderLock(request, lockedHome);
	});
	return result;
}
