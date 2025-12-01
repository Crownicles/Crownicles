import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { MonsterFighter } from "../fighter/MonsterFighter";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { PlayerFighter } from "../fighter/PlayerFighter";

class EsquireFightBehavior implements ClassBehavior {
	private restCount = 0; // Track how many times we've rested

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter();
		const currentRound = fightView.fightController.turn;

		// Initialize defense tracking on first round
		if (currentRound <= 1) {
			this.restCount = 0; // Reset rest counter at the beginning of a fight
		}

		/*
		 * ENDGAME STRATEGY: Try to force a draw if victory seems impossible
		 * Still rest even if we've done it 4 times, because the goal is to stall
		 */
		if (me.getEnergy() < 75 && opponent.getEnergy() > 200) {
			this.restCount++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
		}

		// REST WHEN NEEDED: Not enough breath for actions (only if we haven't rested 4 times)
		if (me.getBreath() < 2 && this.restCount < 4) {
			this.restCount++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
		}

		return simpleOrQuickAttack(me, opponent);
	}
}

/**
 * Choose between a simple or quick attack based on speed comparison and breath
 * @param me
 * @param opponent
 */
export function simpleOrQuickAttack(me: AiPlayerFighter, opponent: PlayerFighter | MonsterFighter): FightAction {
	// Other attacks based on speed comparison
	const mySpeed = me.getSpeed();
	const opponentSpeed = opponent.getSpeed();

	/*
	 * If my speed is greater than the opponent's speed, use a quick attack otherwise, use a simple attack
	 * If we're very low on breath but have already rested 4 times, still try to attack
	 * 85% chance to use quick attack when conditions are met to add variability
	 */
	if (mySpeed > opponentSpeed && (me.getBreath() >= 3 || this.restCount >= 4) && RandomUtils.crowniclesRandom.bool(0.85)) {
		return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.QUICK_ATTACK);
	}
	return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK);
}

export default EsquireFightBehavior;
