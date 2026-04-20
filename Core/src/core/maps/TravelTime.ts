import Player from "../database/game/models/Player";
import {
	asMilliseconds, Millisecond, millisecondsToMinutes, minutesToMilliseconds, nowMs
} from "../../../../Lib/src/utils/TimeUtils";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { Maps } from "./Maps";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { MapLinkDataController } from "../../data/MapLink";
import { crowniclesInstance } from "../../index";
import { Effect } from "../../../../Lib/src/types/Effect";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ReportConstants } from "../../../../Lib/src/constants/ReportConstants";

/**
 * Travel time functions class
 */
export abstract class TravelTime {
	/*
	 * Understand travel time
	 *
	 * Variables :
	 * travelStart -> player.startTravelDate
	 * effectEnd -> player.effectEndDate
	 * effectDuration -> player.effectDuration
	 * effectStart -> travelStart + effectEnd - effectDuration
	 * tripDuration -> MapLink.tripDuration
	 * travelEnd -> travelStart + effectDuration + tripDuration
	 *
	 * This is a scheme of a travel trip :
	 *
	 *      [                               tripDuration                               ]
	 *                         [   effectDuration  ]
	 *
	 *      |------------------|###################|-----------------🧍‍----------------|
	 *      ^                  ^                   ^                 ^                 ^
	 *      |                  |                   |                 |                 |
	 * travelStart        effectStart          effectEnd            now            travelEnd
	 *
	 * Trivia :
	 * - In the /report interface, the effectStart to effectEnd period is hidden and if the player is in this, he is shown as stopped
	 * - Time travel moves all variables to the left (or right if going to the past)
	 */

	/**
	 * Get the travel data
	 * @param player
	 * @param date
	 */
	static async getTravelData(player: Player, date: Date): Promise<{
		travelStartTime: Millisecond;
		travelEndTime: Millisecond;
		effectStartTime: Millisecond;
		effectEndTime: Millisecond;
		effectDuration: Millisecond;
		effectRemainingTime: Millisecond;
		playerTravelledTime: Millisecond;
		nextSmallEventTime: Millisecond;
	}> {
		const data = this.getTravelDataSimplified(player, date);

		const lastSmallEvent = await PlayerSmallEvents.getLastOfPlayer(player.id);
		const timeBetweenSmallEvents = Maps.isOnPveIsland(player) ? PVEConstants.TIME_BETWEEN_SMALL_EVENTS : Constants.REPORT.TIME_BETWEEN_MINI_EVENTS;

		// The next small event in 9min45 after the last thing that happened between the last start of the travel, small event (if there's one since the start of the travel) and end of alteration
		const nextSmallEventTime = asMilliseconds(Math.max(
			data.travelStartTime,
			lastSmallEvent ? lastSmallEvent.time : -1,
			data.effectEndTime
		) + timeBetweenSmallEvents);

		return {
			travelStartTime: data.travelStartTime,
			travelEndTime: data.travelEndTime,
			effectStartTime: data.effectStartTime,
			effectEndTime: data.effectEndTime,
			effectDuration: data.effectDuration,
			effectRemainingTime: data.effectRemainingTime,
			playerTravelledTime: data.playerTravelledTime,
			nextSmallEventTime
		};
	}

	/**
	 * Get the travel data without the small events' data. May be useful if it is not necessary or if the player doesn't
	 * have the small events data
	 * @param player
	 * @param date
	 */
	static getTravelDataSimplified(player: Player, date: Date): {
		travelStartTime: Millisecond;
		travelEndTime: Millisecond;
		effectStartTime: Millisecond;
		effectEndTime: Millisecond;
		effectDuration: Millisecond;
		effectRemainingTime: Millisecond;
		playerTravelledTime: Millisecond;
	} {
		// Basic variables
		const travelStartTime = player.startTravelDate.valueOf();
		let effectEndTime = player.effectEndDate.valueOf();
		let effectDuration = minutesToMilliseconds(player.effectDuration);

		// Check to avoid errors. If the effect is before the travel starts, move it to the beginning of the start travel
		if (effectEndTime < travelStartTime) {
			effectEndTime = travelStartTime;
		}

		/*
		 * Check to avoid errors. If the effect starts before the start of the travel, cut the duration to make it begin
		 * At the start of the travel
		 */
		if (effectEndTime - effectDuration < travelStartTime) {
			effectDuration = asMilliseconds(effectEndTime - travelStartTime);
		}

		// Basic variables
		const effectStartTime = effectEndTime - effectDuration;
		const tripDuration = minutesToMilliseconds(MapLinkDataController.instance.getById(player.mapLinkId)!.tripDuration);
		const travelEndTime = travelStartTime + effectDuration + tripDuration;
		let effectRemainingTime = effectEndTime - date.valueOf();
		if (effectRemainingTime < 0) {
			effectRemainingTime = 0;
		}

		// Player travelled time
		let playerTravelledTime = date.valueOf() - travelStartTime;
		if (date.valueOf() > effectEndTime) {
			playerTravelledTime -= effectDuration;
		}
		else if (date.valueOf() > effectStartTime) {
			playerTravelledTime -= date.valueOf() - effectStartTime;
		}

		return {
			travelStartTime: asMilliseconds(travelStartTime),
			travelEndTime: asMilliseconds(travelEndTime),
			effectStartTime: asMilliseconds(effectStartTime),
			effectEndTime: asMilliseconds(effectEndTime),
			effectDuration,
			effectRemainingTime: asMilliseconds(effectRemainingTime),
			playerTravelledTime: asMilliseconds(playerTravelledTime)
		};
	}

	/**
	 * Move travel-related timers by a duration expressed in milliseconds.
	 *
	 * @param player The player
	 * @param timeMs The time in milliseconds in the future (negative for the past)
	 * @param loggedTime The time in minutes to log
	 * @param reason The reason of the time travel
	 */
	private static async applyTimeTravel(player: Player, timeMs: Millisecond, loggedTime: number, reason: NumberChangeReason): Promise<void> {
		let adjustedTimeMs = timeMs;
		const initialEffectEndDate = player.effectEndDate.valueOf();
		const currentTime = nowMs();

		// Move the end date of the effect
		player.effectEndDate = new Date(Math.max(player.effectEndDate.valueOf() - adjustedTimeMs, 0));

		// Move the start date
		player.startTravelDate = new Date(Math.max(player.startTravelDate.valueOf() - adjustedTimeMs, 0));

		// If the effect is not active anymore and was active before
		if ((player.effectEndDate.valueOf() < currentTime) && (initialEffectEndDate > currentTime)) {
			// We only want to move the start travel date by the amount of the time travel
			adjustedTimeMs = asMilliseconds(currentTime - player.effectEndDate.valueOf());
		}

		if (currentTime > player.effectEndDate.valueOf()) {
			// Move the last small event
			const lastSmallEvent = await PlayerSmallEvents.getLastOfPlayer(player.id);
			if (lastSmallEvent) {
				lastSmallEvent.time -= adjustedTimeMs;
				await lastSmallEvent.save();
			}
		}

		// Log
		crowniclesInstance?.logsDatabase.logTimeWarp(player.keycloakId, loggedTime, reason)
			.then();
	}

	/**
	 * Make a player execute a time travel
	 * Basically, all the variables are moved to the left (future positive time) or right (past, negative time)
	 * See the schema at the beginning of the file
	 *
	 * @param player The player
	 * @param time The time in minutes in the future (negative for the past)
	 * @param reason The reason of the time travel
	 */
	static async timeTravel(player: Player, time: number, reason: NumberChangeReason): Promise<void> {
		await TravelTime.applyTimeTravel(player, minutesToMilliseconds(time), time, reason);
	}

	/**
	 * Make a player execute a time travel in milliseconds
	 * Basically, all the variables are moved to the left (future positive time) or right (past, negative time)
	 * See the schema at the beginning of the file
	 *
	 * @param player The player
	 * @param time The time in milliseconds in the future (negative for the past)
	 * @param reason The reason of the time travel
	 */
	static async timeTravelMilliseconds(player: Player, time: Millisecond, reason: NumberChangeReason): Promise<void> {
		await TravelTime.applyTimeTravel(player, time, millisecondsToMinutes(time), reason);
	}

	/**
	 * Removes the effect of a player
	 * @param player
	 * @param reason
	 */
	static async removeEffect(player: Player, reason: NumberChangeReason): Promise<void> {
		// Make the player time travel to the end of the effect
		await TravelTime.timeTravelMilliseconds(player, player.effectRemainingTime(), reason);

		// Move the start of the travel because the effect will have a duration of 0
		player.startTravelDate = new Date(player.startTravelDate.valueOf() + minutesToMilliseconds(player.effectDuration));

		// Now we can safely remove the effect, as the player is after the effect
		player.effectId = Effect.NO_EFFECT.id;
		player.effectDuration = 0;
		player.effectEndDate = new Date();

		// Save
		await player.save();
	}

	/**
	 * Check if effect uses custom duration
	 * @param effect
	 * @param time
	 */
	private static shouldUseCustomDuration(effect: Effect, time: number): boolean {
		return effect === Effect.OCCUPIED || (effect === Effect.SLEEPING && time > 0);
	}

	/**
	 * Apply an effect to a player
	 * @param player
	 * @param effect
	 * @param time
	 * @param date The date of the beginning of the effect
	 * @param reason
	 */
	static async applyEffect(player: Player, effect: Effect, time: number, date: Date, reason: NumberChangeReason): Promise<void> {
		/*
		 * Reason is IGNORE here because you don't want to log a time warp when you get an alteration
		 * First remove the effect (if the effect is time related)
		 */
		if (![
			Effect.NO_EFFECT.id,
			Effect.NOT_STARTED.id,
			Effect.DEAD.id
		].includes(player.effectId)) {
			await this.removeEffect(player, NumberChangeReason.IGNORE);
		}

		// Apply the new effect
		player.effectId = effect.id;
		if (this.shouldUseCustomDuration(effect, time)) {
			// OCCUPIED always uses custom duration, SLEEPING only if time > 0 is provided
			player.effectDuration = time;
		}
		else {
			player.effectDuration = effect.timeMinutes;
		}
		player.effectEndDate = new Date(date.valueOf() + minutesToMilliseconds(player.effectDuration));

		// Save and log
		await player.save();
		crowniclesInstance?.logsDatabase.logAlteration(player.keycloakId, effect.id, reason, time)
			.then();
	}

	/**
	 * Calculates a score based on the time traveled
	 * @param time - time must be in milliseconds
	 */
	static timeTravelledToScore(time: Millisecond): number {
		const timeMinutes = millisecondsToMinutes(time);
		const score = timeMinutes + RandomUtils.crowniclesRandom.integer(0, timeMinutes / Constants.REPORT.BONUS_POINT_TIME_DIVIDER);
		return score > 0 ? score : 0; // Return 0 if the score is negative
	}

	/**
	 * Calculates a score based on the time traveled and the small events done during the trip.
	 * Used when a player boards a boat (joinBoat command or goToPVEIsland small event).
	 */
	static async joinBoatScore(player: Player): Promise<number> {
		const travelData = TravelTime.getTravelDataSimplified(player, new Date());
		const timeTravelled = travelData.playerTravelledTime;

		// Calculate score from small event
		let scoreFromSmallEvent = 0;

		// Divide by 3 if the player has travelled between 30 minutes and 1 hour.
		if (timeTravelled >= Constants.JOIN_BOAT.TIME_TRAVELLED_THIRTY_MINUTES && timeTravelled < Constants.JOIN_BOAT.TIME_TRAVELLED_ONE_HOUR) {
			scoreFromSmallEvent = Math.floor(await PlayerSmallEvents.calculateCurrentScore(player) / Constants.JOIN_BOAT.DIVISOR_TIME_TRAVELLED_LESS_THAN_ONE_HOUR);
		}
		if (timeTravelled >= Constants.JOIN_BOAT.TIME_TRAVELLED_ONE_HOUR) {
			scoreFromSmallEvent = await PlayerSmallEvents.calculateCurrentScore(player);
		}
		let adjustedTravelTime = asMilliseconds(Math.max(timeTravelled - Constants.JOIN_BOAT.TIME_TRAVELLED_SUBTRAHEND, 0));
		const maxTravelTime = minutesToMilliseconds(ReportConstants.TIME_LIMIT);
		if (adjustedTravelTime > maxTravelTime) {
			adjustedTravelTime = maxTravelTime;
		}
		return TravelTime.timeTravelledToScore(adjustedTravelTime) + scoreFromSmallEvent;
	}
}
