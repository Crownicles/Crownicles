import { FightStatBuffed } from "../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../Lib/src/types/FightStatModifierOperation";
import { PetAssistanceResult } from "../../../../../Lib/src/types/PetAssistanceResult";
import { Fighter } from "../fighter/Fighter";
import { PlayerBaseFighter } from "../fighter/PlayerBaseFighter";
import { FightActionController } from "./FightActionController";
import { EquippedMainItemSlot } from "../../database/game/models/PlayerActiveObjects";
import { StatValues } from "../../../../../Lib/src/types/StatValues";

export type GearStatPart = {
	stat: FightStatBuffed;
	total: number;
	gear: number;
};

/**
 * Multiplier removing the gear share of a stat, or `null` when it cannot be computed:
 * a stat already at 0 would otherwise become `0 * Infinity = NaN` and cancel every attack using it (#4883)
 */
export function getGearRemovalMultiplier({
	total, gear
}: GearStatPart): number | null {
	if (gear === 0 || total <= 0) {
		return null;
	}
	return Math.max(0, (total - gear) / total);
}

/**
 * Stats the equipped weapon or armor of the target adds to its fight stats, capped by its class,
 * or `null` when there is nothing to remove: monsters carry no gear, and a gear without its main stat is not worth removing
 * @param target
 * @param slot
 * @param mainStat The stat the gear is meant to provide (attack for a weapon, defense for an armor)
 */
export async function getRemovableGearStats(target: Fighter, slot: EquippedMainItemSlot, mainStat: keyof StatValues): Promise<StatValues | null> {
	if (!(target instanceof PlayerBaseFighter)) {
		return null;
	}
	const gearStats = await target.getEquippedMainItemStats(slot);
	return gearStats[mainStat] === 0 ? null : gearStats;
}

/**
 * Lower the target's stats by the share its removed gear was providing, skipping the stats that cannot be computed
 */
export function applyGearRemovalBuffs(result: PetAssistanceResult, target: Fighter, parts: GearStatPart[]): void {
	for (const part of parts) {
		const multiplier = getGearRemovalMultiplier(part);
		if (multiplier !== null) {
			FightActionController.applyBuff(result, {
				selfTarget: false,
				stat: part.stat,
				operator: FightStatModifierOperation.MULTIPLIER,
				value: multiplier
			}, target, null);
		}
	}
}
