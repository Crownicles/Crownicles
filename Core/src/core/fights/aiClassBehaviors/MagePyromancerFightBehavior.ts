import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import { Fighter } from "../fighter/Fighter";
import { FightAction } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	canAfford, chooseAgainstAilingOpponent, getAction
} from "./MysticMageFightBehavior";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;

/**
 * Dark attack cashing an alteration in (its curse, or the burn of its fire attacks), when the mage has the breath for it. Null otherwise
 * @param me
 * @param opponent
 */
function chooseCashIn(me: AiPlayerFighter, opponent: Fighter): FightAction | null {
	return opponent.hasFightAlteration() && canAfford(me, ACTIONS.DARK_ATTACK) ? chooseAgainstAilingOpponent(me, opponent) : null;
}

/**
 * Pyromancer mage: curses its opponent whenever it is free of any alteration, burns it with fire attacks as soon as it
 * has the breath for them, and cashes the curse or the burns in with the dark attack
 */
class MagePyromancerFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();
		if (!opponent) {
			return getAction(ACTIONS.BREATH_TAKING_ATTACK);
		}

		if (!opponent.hasFightAlteration() && canAfford(me, ACTIONS.CURSED_ATTACK)) {
			return getAction(ACTIONS.CURSED_ATTACK);
		}

		// The cheap breath-taking attack lets the breath build up for the next fire attack, unlike the poison
		return chooseCashIn(me, opponent)
			?? getAction(canAfford(me, ACTIONS.FIRE_ATTACK) ? ACTIONS.FIRE_ATTACK : ACTIONS.BREATH_TAKING_ATTACK);
	}
}

export default MagePyromancerFightBehavior;
