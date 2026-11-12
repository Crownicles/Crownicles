import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../database/game/models/Player";
import { MissionsController } from "../missions/MissionsController";
import { withLockedPlayerAndMissionsSafe } from "../utils/withLockedPlayerAndMissionsSafe";
import {
	SmallEventDataController, SmallEventExecutionContext, SmallEventFuncs
} from "../../data/SmallEvent";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PacketUtils } from "../utils/PacketUtils";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { crowniclesInstance } from "../../app";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";

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
	execution: SmallEventExecutionContext
): Promise<SmallEventEligibility | null> {
	const smallEvent = SmallEventDataController.getSmallEventFunction(key);
	if (!smallEvent) {
		PacketUtils.pushInternalError(execution.response, `Small event ${key} doesn't export its functions`);
		return null;
	}

	if (!await smallEvent.canBeExecuted(player, execution.playerActiveObjects)) {
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
	execution: SmallEventExecutionContext
): Promise<SmallEventEligibility[]> {
	const keys = SmallEventDataController.instance.getKeys();
	const eligibleEvents: SmallEventEligibility[] = [];

	for (const key of keys) {
		const eligibility = await checkSmallEventEligibility(key, player, execution);
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
	player: Player,
	execution: SmallEventExecutionContext
): Promise<string | null> {
	const eligibleEvents = await getEligibleSmallEvents(player, execution);

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
	player: Player,
	execution: SmallEventExecutionContext
): Promise<void> {
	const filename = `${event}.js`;
	const smallEvent = SmallEventDataController.getSmallEventFunction(event);
	if (!smallEvent) {
		PacketUtils.pushInternalError(execution.response, `Small event file ${filename} doesn't exist`);
		return;
	}

	try {
		await crowniclesInstance.logsDatabase.logSmallEvent(player.keycloakId, event);

		await runSmallEventUnderLock(player, event, smallEvent, execution);
	}
	catch (e) {
		PacketUtils.pushInternalError(execution.response, `Error while executing ${filename} small event`, { cause: e });
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
 * (handled per file in PR-H2). Rows the small event mutates besides the
 * player (`getAdditionalLockKeys`, e.g. the home) join the same lock set,
 * so that it keeps the canonical order.
 */
async function runSmallEventUnderLock(
	player: Locked<Player>,
	event: string,
	smallEvent: SmallEventFuncs,
	execution: SmallEventExecutionContext
): Promise<void> {
	const additionalLockKeys = await smallEvent.getAdditionalLockKeys?.(player) ?? [];
	await withLockedPlayerAndMissionsSafe(player, "runSmallEventUnderPlayerLock", async lockedPlayer => {
		/*
		 * Insert the small-event record BEFORE the body so it is affected
		 * by timeTravel() when the event mutates it. Same transaction as
		 * the body, so a concurrent racer never observes a half-applied
		 * effect (record present but body not yet committed, or vice-versa).
		 */
		const smallEventRecord = PlayerSmallEvents.createPlayerSmallEvent(lockedPlayer.id, event, Date.now());
		await smallEventRecord.save();
		await smallEvent.executeSmallEvent(lockedPlayer, execution);
		await lockedPlayer.save();
		await MissionsController.update(lockedPlayer, execution.response, { missionId: "doReports" });
	}, additionalLockKeys);
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
	const execution: SmallEventExecutionContext = {
		response,
		context,
		playerActiveObjects: await InventorySlots.getPlayerActiveObjects(player.id)
	};

	// Pick a random event or use forced one
	const event = forced ?? await getRandomSmallEvent(player, execution);

	if (!event) {
		PacketUtils.pushInternalError(response, "No small event can be executed", {
			context: { keycloakId: player.keycloakId }
		});
		return;
	}

	await loadAndExecuteSmallEvent(event, player, execution);
}
