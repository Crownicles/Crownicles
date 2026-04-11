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

function isMage(fighter: Fighter): boolean {
	if (!(fighter instanceof PlayerFighter || fighter instanceof AiPlayerFighter)) {
		return false;
	}
	return fighter.player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE;
}

const use: FightAlterationFunc = (affected, fightAlteration) => {
	/*
	 * Paladins shake off the fear more easily and have less nerf
	 * Mages are almost immunized but have full nerf
	 */
	const affectedIsPaladin = isPaladin(affected);
	const heroicHealChance = affectedIsPaladin ? 0.8 : 0.3;
	if (isMage(affected) && RandomUtils.crowniclesRandom.bool(0.8) || (affected.alterationTurn > 3 || (affected.alterationTurn > 1 && RandomUtils.crowniclesRandom.bool(heroicHealChance)))) {
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
			value: affectedIsPaladin ? 0.5 : 0.3
		}, affected, fightAlteration);
	}

	if (!affected.hasSpeedModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.SPEED,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: affectedIsPaladin ? 0.6 : 0.3
		}, affected, fightAlteration);
	}

	if (!affected.hasDefenseModifier(fightAlteration)) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.DEFENSE,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: affectedIsPaladin ? 0.8 : 0.4
		}, affected, fightAlteration);
	}

	return result;
};

export default use;
