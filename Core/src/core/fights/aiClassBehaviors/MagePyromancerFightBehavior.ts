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
 * Dark attack cashing a curse in while it lasts, when the mage has the breath for it. Null otherwise
 * @param me
 * @param opponent
 */
function chooseCurseCashIn(me: AiPlayerFighter, opponent: Fighter): FightAction | null {
	return canAfford(me, ACTIONS.DARK_ATTACK) ? chooseAgainstAilingOpponent(me, opponent) : null;
}

/**
 * Pyromancer mage: curses its opponent whenever it is free of any alteration, cashes the curse in with the dark attack,
 * which strikes a cursed opponent at full power, while it lasts if it has the breath for it, and burns its opponent
 * with fire attacks the rest of the time
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
		const opponentCursed = opponent.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED;
		return (opponentCursed ? chooseCurseCashIn(me, opponent) : null)
			?? getAction(canAfford(me, ACTIONS.FIRE_ATTACK) ? ACTIONS.FIRE_ATTACK : ACTIONS.BREATH_TAKING_ATTACK);
	}
}

export default MagePyromancerFightBehavior;
