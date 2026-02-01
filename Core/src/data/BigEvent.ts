import { DataControllerNumber } from "./DataController";
import { Data } from "./Data";
import {
	BigEventTrigger, verifyTrigger
} from "./events/BigEventTrigger";
import { Possibility } from "./events/Possibility";
import Player from "../core/database/game/models/Player";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { verifyPossibilityCondition } from "./events/PossibilityCondition";

export class BigEvent extends Data<number> {
	/**
	 * The big event triggers
	 */
	public readonly triggers!: BigEventTrigger[];

	/**
	 * The big event possibilities
	 */
	private readonly possibilities!: { [key: string]: Possibility };

	/**
	 * Big event tags
	 */
	public readonly tags!: string[];

	/**
	 * The possibility condition is checked to choose to allow the possibility or not
	 * @param player
	 */
	public async getPossibilities(player: Player): Promise<[string, Possibility][]> {
		const possibilities: [string, Possibility][] = [];

		for (const entry of Object.entries(this.possibilities)) {
			const possibility = entry[1];
			if (!possibility.condition || await verifyPossibilityCondition(possibility.condition, player)) {
				possibilities.push(entry);
			}
		}

		return possibilities;
	}
}

export class BigEventDataController extends DataControllerNumber<BigEvent> {
	static readonly instance: BigEventDataController = new BigEventDataController("events");

	private globalEvents: BigEvent[] | null = null;

	private mapEvents: Map<number, BigEvent[]> = new Map();

	newInstance(): BigEvent {
		return new BigEvent();
	}

	/**
	 * Get events for this player on this map but don't check the triggers
	 * @param mapId
	 */
	public getEventsNotFiltered(mapId: number): BigEvent[] {
		if (!this.globalEvents) {
			this.globalEvents = this.getValuesArray().filter(event => event.triggers?.filter(trigger => trigger.mapId).length === 0);
		}

		let mapEvents: BigEvent[];
		if (!this.mapEvents.has(mapId)) {
			mapEvents = this.getValuesArray().filter(event => event.triggers?.filter(trigger => trigger.mapId === mapId).length !== 0);
			this.mapEvents.set(mapId, mapEvents);
		}
		else {
			mapEvents = this.mapEvents.get(mapId)!;
		}

		return this.globalEvents!.concat(mapEvents);
	}

	/**
	 * Get available events for this player on this map
	 * @param mapId
	 * @param player
	 */
	public async getAvailableEvents(mapId: number, player: Player): Promise<BigEvent[]> {
		const possibleBigEvents = this.getEventsNotFiltered(mapId);
		const possibleBigEventsFiltered = [];

		for (const possibleBigEvent of possibleBigEvents) {
			for (const trigger of possibleBigEvent.triggers) {
				if (await verifyTrigger(possibleBigEvent, trigger, mapId, player)) {
					possibleBigEventsFiltered.push(possibleBigEvent);
					break;
				}
			}
		}

		return possibleBigEventsFiltered;
	}

	/**
	 * Get a random event on the map
	 * @param mapId
	 * @param player
	 */
	public async getRandomEvent(mapId: number, player: Player): Promise<BigEvent | null> {
		const possibleEvents = await this.getAvailableEvents(mapId, player);

		if (possibleEvents.length === 0) {
			return null;
		}
		return RandomUtils.crowniclesRandom.pick(possibleEvents);
	}
}
