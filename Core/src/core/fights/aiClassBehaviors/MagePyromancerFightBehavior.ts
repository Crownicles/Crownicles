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
 * Pyromancer mage: curses its opponent with its first move, cashes the curse in with the dark attack while it lasts
 * if it has the breath for it, then burns its opponent with fire attacks once the curse has fallen
 */
/**
 * Dark attack cashing a curse in while it lasts, when the mage has the breath for it. Null otherwise
 * @param me
 */
function chooseCurseCashIn(me: AiPlayerFighter): FightAction | null {
	return canAfford(me, ACTIONS.DARK_ATTACK) ? chooseAgainstAilingOpponent(me) : null;
}

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
		if (this.shouldCurse(me, opponent)) {
			return getAction(ACTIONS.CURSED_ATTACK);
		}

		// The cheap breath-taking attack lets the breath build up for the next fire attack, unlike the poison
		return (opponentCursed ? chooseCurseCashIn(me) : null)
			?? getAction(canAfford(me, ACTIONS.FIRE_ATTACK) ? ACTIONS.FIRE_ATTACK : ACTIONS.BREATH_TAKING_ATTACK);
	}

	private shouldCurse(me: AiPlayerFighter, opponent: Fighter): boolean {
		return !this.curseLanded && !opponent.hasFightAlteration() && canAfford(me, ACTIONS.CURSED_ATTACK);
	}
}

export default MagePyromancerFightBehavior;
