import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../database/game/models/Player";
import { MissionsController } from "../missions/MissionsController";
import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ErrorPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { crowniclesInstance } from "../../index";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

/**
 * Small event eligibility result
 */
interface SmallEventEligibility {
	key: string;
	rarity: number;
}

/**
 * Check if a small event can be executed
 */
async function checkSmallEventEligibility(
	key: string,
	player: Player,
	playerActiveObjects: PlayerActiveObjects,
	response: CrowniclesPacket[]
): Promise<SmallEventEligibility | null> {
	const file = await import(`../smallEvents/${key}.js`);

	if (!file.smallEventFuncs?.canBeExecuted) {
		response.push(makePacket(ErrorPacket, { message: `${key} doesn't contain a canBeExecuted function` }));
		return null;
	}

	const canExecute = await file.smallEventFuncs.canBeExecuted(player, playerActiveObjects);
	if (!canExecute) {
		return null;
	}

	return {
		key,
		rarity: SmallEventDataController.instance.getById(key)!.rarity
	};
}

/**
 * Get all eligible small events for a player
 */
async function getEligibleSmallEvents(
	player: Player,
	playerActiveObjects: PlayerActiveObjects,
	response: CrowniclesPacket[]
): Promise<SmallEventEligibility[]> {
	const keys = SmallEventDataController.instance.getKeys();
	const eligibleEvents: SmallEventEligibility[] = [];

	for (const key of keys) {
		const eligibility = await checkSmallEventEligibility(key, player, playerActiveObjects, response);
		if (eligibility) {
			eligibleEvents.push(eligibility);
		}
	}

	return eligibleEvents;
}

/**
 * Select a random small event based on rarity weights
 */
function selectRandomSmallEvent(eligibleEvents: SmallEventEligibility[]): string | null {
	const totalRarity = eligibleEvents.reduce((sum, e) => sum + e.rarity, 0);
	const randomNb = RandomUtils.randInt(1, totalRarity + 1);

	let sum = 0;
	for (const event of eligibleEvents) {
		sum += event.rarity;
		if (sum >= randomNb) {
			return event.key;
		}
	}

	return null;
}

/**
 * Get a random small event key based on rarity weighting
 */
async function getRandomSmallEvent(
	response: CrowniclesPacket[],
	player: Player,
	playerActiveObjects: PlayerActiveObjects
): Promise<string | null> {
	const eligibleEvents = await getEligibleSmallEvents(player, playerActiveObjects, response);

	if (eligibleEvents.length === 0) {
		return null;
	}

	return selectRandomSmallEvent(eligibleEvents);
}

/**
 * Load and execute a small event module
 */
async function loadAndExecuteSmallEvent(
	event: string,
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext,
	playerActiveObjects: PlayerActiveObjects
): Promise<void> {
	const filename = `${event}.js`;

	try {
		const smallEventModule = require.resolve(`../smallEvents/${filename}`);
		try {
			const smallEvent: SmallEventFuncs = require(smallEventModule).smallEventFuncs;
			await crowniclesInstance.logsDatabase.logSmallEvent(player.keycloakId, event);

			await runSmallEventUnderPlayerLock(player, event, smallEvent, response, context, playerActiveObjects);
		}
		catch (e) {
			CrowniclesLogger.errorWithObj(`Error while executing ${filename} small event`, e);
			response.push(makePacket(ErrorPacket, { message: `${e}` }));
		}
	}
	catch {
		response.push(makePacket(ErrorPacket, { message: `${filename} doesn't exist` }));
	}
}

/**
 * Run the small event implementation and the subsequent mission update
 * inside a single Player row lock. The fresh `PlayerSmallEvent` row is
 * inserted *inside* the same critical section so the record + the body
 * mutations form a single atomic unit (and a concurrent report racing
 * for the same player observes either both writes or neither). All
 * `player.save()` invoked transitively inherit the surrounding
 * transaction through cls-hooked, so concurrent reports for the same
 * player are serialised on the database side. Small events that defer
 * their mutations to a later collector callback acquire the lock for
 * their setup phase only — the deferred callback re-locks itself
 * (handled per file in PR-H2).
 */
async function runSmallEventUnderPlayerLock(
	player: Player,
	event: string,
	smallEvent: SmallEventFuncs,
	response: CrowniclesPacket[],
	context: PacketContext,
	playerActiveObjects: PlayerActiveObjects
): Promise<void> {
	try {
		await withLockedEntities([Player.lockKey(player.id)], async ([lockedPlayer]) => {
			/*
			 * Insert the small-event record BEFORE the body so it is affected
			 * by timeTravel() when the event mutates it. Same transaction as
			 * the body, so a concurrent racer never observes a half-applied
			 * effect (record present but body not yet committed, or vice-versa).
			 */
			const smallEventRecord = PlayerSmallEvents.createPlayerSmallEvent(lockedPlayer.id, event, Date.now());
			await smallEventRecord.save();
			await smallEvent.executeSmallEvent(response, lockedPlayer, context, playerActiveObjects);
			await MissionsController.update(lockedPlayer, response, { missionId: "doReports" });
		});
	}
	catch (e) {
		if (e instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(
				`runSmallEventUnderPlayerLock: locked row vanished for player ${player.id} — small event aborted`
			);
			return;
		}
		throw e;
	}
}

/**
 * Executes a small event
 */
export async function executeSmallEvent(
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext,
	forced: string | null
): Promise<void> {
	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);

	// Pick a random event or use forced one
	const event = forced ?? await getRandomSmallEvent(response, player, playerActiveObjects);

	if (!event) {
		response.push(makePacket(ErrorPacket, { message: "No small event can be executed..." }));
		return;
	}

	await loadAndExecuteSmallEvent(event, response, player, context, playerActiveObjects);
}
