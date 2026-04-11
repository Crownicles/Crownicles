import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import {
	defaultFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { Fighter } from "../../../fighter/Fighter";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { AiPlayerFighter } from "../../../fighter/AiPlayerFighter";
import { ClassConstants } from "../../../../../../../Lib/src/constants/ClassConstants";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

function isPaladin(fighter: Fighter): boolean {
	if (!(fighter instanceof PlayerFighter || fighter instanceof AiPlayerFighter)) {
		return false;
	}
	return fighter.player.class === ClassConstants.CLASSES_ID.PALADIN
		|| fighter.player.class === ClassConstants.CLASSES_ID.LUMINOUS_PALADIN;
}

const use: FightAlterationFunc = (affected, fightAlteration) => {
	// Paladins shake off the fear more easily, other classes endure longer
	const heroicHealChance = isPaladin(affected) ? 0.8 : 0.3;
	if (affected.alterationTurn > 3 || (affected.alterationTurn > 1 && RandomUtils.crowniclesRandom.bool(heroicHealChance))) {
		affected.removeAttackModifiers(fightAlteration);
		affected.removeSpeedModifiers(fightAlteration);
		affected.removeDefenseModifiers(fightAlteration);
		return defaultHealFightAlterationResult(affected);
	}

	const result = defaultFightAlterationResult();

	if (!affected.hasAttackModifier(fightAlteration)) {
		result.state = FightAlterationState.NEW;
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ATTACK,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.5
		}, affected, fightAlteration);
	}

	if (!affected.hasSpeedModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.8
		}, affected, fightAlteration);
	}

	if (!affected.hasDefenseModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.DEFENSE,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: 0.2
		}, affected, fightAlteration);
	}

	return result;
};

export default use;
