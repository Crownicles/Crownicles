import { Player } from "../database/game/models/Player";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import { millisecondsToMinutes } from "../../../../Lib/src/utils/TimeUtils";
import { Effect } from "../../../../Lib/src/types/Effect";
import { TravelTime } from "../maps/TravelTime";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { MissionsController } from "../missions/MissionsController";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { Maps } from "../maps/Maps";

/**
 * Calculate the price for healing from an alteration
 * Price is degressive based on remaining time
 * @param player
 */
export function calculateHealAlterationPrice(player: Player): number {
	let price = ShopConstants.ALTERATION_HEAL_BASE_PRICE;
	const remainingTime = millisecondsToMinutes(player.effectRemainingTime());

	/*
	 * If the remaining time is under one hour,
	 * The price becomes degressive until being divided by MAX_PRICE_REDUCTION_DIVISOR at the 15-minute mark;
	 * Then it no longer decreases
	 */
	if (remainingTime < ShopConstants.MAX_REDUCTION_TIME) {
		if (remainingTime <= ShopConstants.MIN_REDUCTION_TIME) {
			price /= ShopConstants.MAX_PRICE_REDUCTION_DIVISOR;
		}
		else {
			// Calculate the price reduction based on the remaining time
			const priceDecreasePerMinute = (
				ShopConstants.ALTERATION_HEAL_BASE_PRICE - ShopConstants.ALTERATION_HEAL_BASE_PRICE / ShopConstants.MAX_PRICE_REDUCTION_DIVISOR
			) / (
				ShopConstants.MAX_REDUCTION_TIME - ShopConstants.MIN_REDUCTION_TIME
			);
			price -= priceDecreasePerMinute * (ShopConstants.MAX_REDUCTION_TIME - remainingTime);
		}
	}
	return Math.round(price);
}

/**
 * Check if a player can be healed from their alteration
 * @param player
 * @param currentDate
 */
export function canHealAlteration(player: Player, currentDate: Date): {
	canHeal: boolean;
	reason?: "no_alteration" | "occupied" | "dead_or_jailed";
} {
	// Check if player has an alteration
	if (player.currentEffectFinished(currentDate)) {
		return {
			canHeal: false,
			reason: "no_alteration"
		};
	}

	// Check if the alteration is occupied (cannot be healed)
	if (player.effectId === Effect.OCCUPIED.id) {
		return {
			canHeal: false,
			reason: "occupied"
		};
	}

	// Check if player is dead or jailed (special case)
	if (player.effectId === Effect.DEAD.id || player.effectId === Effect.JAILED.id) {
		return {
			canHeal: false,
			reason: "dead_or_jailed"
		};
	}

	return { canHeal: true };
}

/**
 * Heal a player's alteration and advance them to the next small event
 * @param player
 * @param currentDate
 * @param reason - The reason for the number change (SHOP or REPORT_TOKENS)
 * @param response
 * @returns Whether the player arrived at their destination after healing
 */
export async function healAlterationAndAdvance(
	player: Player,
	currentDate: Date,
	reason: NumberChangeReason,
	response: CrowniclesPacket[]
): Promise<boolean> {
	// Remove the effect
	await TravelTime.removeEffect(player, reason);

	// Get travel data to know when the next small event is
	const timeData = await TravelTime.getTravelData(player, currentDate);

	// Make the player time travel to the next small event
	await TravelTime.timeTravel(
		player,
		timeData.nextSmallEventTime - currentDate.valueOf(),
		reason,
		true
	);

	await player.save();

	// Update mission
	await MissionsController.update(player, response, { missionId: "recoverAlteration" });

	// Check if player arrived at destination
	const newDate = new Date();
	return Maps.isArrived(player, newDate);
}
