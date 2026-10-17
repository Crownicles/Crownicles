import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { AiPlayerFighter } from "../../../fighter/AiPlayerFighter";

type ArmorStatPart = {
	stat: FightStatBuffed;
	total: number;
	armor: number;
};

/**
 * Multiplier removing the armor share of a stat, or `null` when it cannot be computed:
 * a stat already at 0 would otherwise become `0 * Infinity = NaN` and cancel every attack using it (#4883)
 */
function getArmorRemovalMultiplier({
	total, armor
}: ArmorStatPart): number | null {
	if (armor === 0 || total <= 0) {
		return null;
	}
	return Math.max(0, (total - armor) / total);
}

const use: PetAssistanceFunc = async (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Execute at the start of the fight
	if (turn > 2) {
		return null;
	}
	let armorDamages = 0;
	let armorDefense = 0;
	let armorSpeed = 0;

	// Check if the opponent is a player or an AI player
	if (opponent instanceof PlayerFighter || opponent instanceof AiPlayerFighter) {
		const memberActiveObjects = await opponent.getMainActiveObjects();
		armorDamages = memberActiveObjects.armor.item.getAttack(memberActiveObjects.armor.itemLevel);
		armorDefense = memberActiveObjects.armor.item.getDefense(memberActiveObjects.armor.itemLevel);
		armorSpeed = memberActiveObjects.armor.item.getSpeed(memberActiveObjects.armor.itemLevel);
	}

	// 15% chance to fail to break the armor
	if (RandomUtils.crowniclesRandom.bool(0.15) || armorDefense === 0) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Lower the opponent's stats by the share its armor was providing
	const armorStatParts: ArmorStatPart[] = [
		{
			stat: FightStatBuffed.DEFENSE, total: opponent.getDefense(), armor: armorDefense
		},
		{
			stat: FightStatBuffed.ATTACK, total: opponent.getAttack(), armor: armorDamages
		},
		{
			stat: FightStatBuffed.SPEED, total: opponent.getSpeed(), armor: armorSpeed
		}
	];
	for (const part of armorStatParts) {
		const multiplier = getArmorRemovalMultiplier(part);
		if (multiplier !== null) {
			FightActionController.applyBuff(result, {
				selfTarget: false,
				stat: part.stat,
				operator: FightStatModifierOperation.MULTIPLIER,
				value: multiplier
			}, opponent, null);
		}
	}

	return Promise.resolve(result);
};

export default use;
