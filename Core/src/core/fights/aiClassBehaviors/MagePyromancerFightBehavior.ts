import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import { FightAction } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	canAfford, chooseAgainstAilingOpponent, getAction
} from "./MysticMageFightBehavior";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;

/**
 * Pyromancer mage: curses its opponent with its first move, cashes the curse in with the dark attack while it lasts
 * if it has the breath for it, then burns its opponent with fire attacks once the curse has fallen
 */
class MagePyromancerFightBehavior implements ClassBehavior {
	// A protected opponent resists the curse: the mage casts it again until it lands once
	private curseLanded = false;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();
		if (!opponent) {
			return getAction(ACTIONS.BREATH_TAKING_ATTACK);
		}

		const opponentCursed = opponent.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED;
		this.curseLanded ||= opponentCursed;
		if (!this.curseLanded && !opponent.hasFightAlteration() && canAfford(me, ACTIONS.CURSED_ATTACK)) {
			return getAction(ACTIONS.CURSED_ATTACK);
		}

		if (opponentCursed && canAfford(me, ACTIONS.DARK_ATTACK)) {
			const cashIn = chooseAgainstAilingOpponent(me);
			if (cashIn) {
				return cashIn;
			}
		}

		// The cheap breath-taking attack lets the breath build up for the next fire attack, unlike the poison
		return getAction(canAfford(me, ACTIONS.FIRE_ATTACK) ? ACTIONS.FIRE_ATTACK : ACTIONS.BREATH_TAKING_ATTACK);
	}
}

export default MagePyromancerFightBehavior;
