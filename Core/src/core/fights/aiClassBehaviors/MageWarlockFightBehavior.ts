import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import { FightAction } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	canAfford, chooseAgainstAilingOpponent, chooseDamagingAttack, getAction
} from "./MysticMageFightBehavior";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;

// The warlock keeps its breath for its curse and its dark attack: it only burns its opponent with this much breath
const WARLOCK_MIN_FIRE_BREATH = 10;

/**
 * Warlock mage: curses every clean opponent (which cuts its healing and heals the mage), cashes the curse in with
 * the dark attack, and burns or poisons its opponent while the dark attack recovers
 */
class MageWarlockFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();
		if (!opponent) {
			return getAction(ACTIONS.BREATH_TAKING_ATTACK);
		}

		if (opponent.hasFightAlteration()) {
			const cashIn = chooseAgainstAilingOpponent(me, opponent);
			if (cashIn) {
				return cashIn;
			}
		}
		else if (canAfford(me, ACTIONS.CURSED_ATTACK)) {
			return getAction(ACTIONS.CURSED_ATTACK);
		}

		return chooseDamagingAttack(me, WARLOCK_MIN_FIRE_BREATH);
	}
}

export default MageWarlockFightBehavior;
