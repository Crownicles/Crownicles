import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import { FightAction } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	canAfford, chooseAgainstAilingOpponent, getAction, POISON_OPENING_LAST_TURN
} from "./MysticMageFightBehavior";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;

/**
 * Pyromancer mage: opens with the poison, then sets its opponent on fire whenever it is not ailing, cashes the burn
 * in with the dark attack, and steals breath with its cheap attack to afford the next fire attack
 */
class MagePyromancerFightBehavior implements ClassBehavior {
	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();
		if (!opponent) {
			return getAction(ACTIONS.BREATH_TAKING_ATTACK);
		}

		if (opponent.hasFightAlteration()) {
			const cashIn = chooseAgainstAilingOpponent(me);
			if (cashIn) {
				return cashIn;
			}
		}
		else if (fightView.fightController.turn <= POISON_OPENING_LAST_TURN && canAfford(me, ACTIONS.POISONOUS_ATTACK)) {
			return getAction(ACTIONS.POISONOUS_ATTACK);
		}

		// Burns a clean opponent, and keeps hitting with fire once the dark attack is worn
		return getAction(canAfford(me, ACTIONS.FIRE_ATTACK) ? ACTIONS.FIRE_ATTACK : ACTIONS.BREATH_TAKING_ATTACK);
	}
}

export default MagePyromancerFightBehavior;
