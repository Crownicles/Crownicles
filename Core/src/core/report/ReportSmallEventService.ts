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
	response: CrowniclesPacket[]
): Promise<SmallEventEligibility | null> {
	const file = await import(`../smallEvents/${key}.js`);

	if (!file.smallEventFuncs?.canBeExecuted) {
		response.push(makePacket(ErrorPacket, { message: `${key} doesn't contain a canBeExecuted function` }));
		return null;
	}

	const canExecute = await file.smallEventFuncs.canBeExecuted(player);
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
	response: CrowniclesPacket[]
): Promise<SmallEventEligibility[]> {
	const keys = SmallEventDataController.instance.getKeys();
	const eligibleEvents: SmallEventEligibility[] = [];

	for (const key of keys) {
		const eligibility = await checkSmallEventEligibility(key, player, response);
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
 * Get a random small event
 */
async function getRandomSmallEvent(response: CrowniclesPacket[], player: Player): Promise<string | null> {
	const eligibleEvents = await getEligibleSmallEvents(player, response);

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
	context: PacketContext
): Promise<void> {
	const filename = `${event}.js`;

	try {
		const smallEventModule = require.resolve(`../smallEvents/${filename}`);
		try {
			const smallEvent: SmallEventFuncs = require(smallEventModule).smallEventFuncs;
			crowniclesInstance?.logsDatabase.logSmallEvent(player.keycloakId, event).then();

			// Save the small event BEFORE execution so it gets affected by timeTravel() if the event succeeds
			const smallEventRecord = PlayerSmallEvents.createPlayerSmallEvent(player.id, event, Date.now());
			await smallEventRecord.save();

			await smallEvent.executeSmallEvent(response, player, context);
			await MissionsController.update(player, response, { missionId: "doReports" });
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
 * Executes a small event
 */
export async function executeSmallEvent(
	response: CrowniclesPacket[],
	player: Player,
	context: PacketContext,
	forced: string | null
): Promise<void> {
	// Pick a random event or use forced one
	const event = forced ?? await getRandomSmallEvent(response, player);

	if (!event) {
		response.push(makePacket(ErrorPacket, { message: "No small event can be executed..." }));
		return;
	}

	await loadAndExecuteSmallEvent(event, response, player, context);
}
