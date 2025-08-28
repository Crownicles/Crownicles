import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { simpleOrQuickAttack } from "./EsquireFightBehavior";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

class HorseRiderFightBehavior implements ClassBehavior {
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
		if (me.getEnergy() < 125 && opponent.getEnergy() > 400) {
			this.restCount++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
		}

		// Heavy attacks if the opponent has more defense and we have enough breath
		if ((me.getLastFightActionUsed() && me.getLastFightActionUsed().id === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
				|| RandomUtils.crowniclesRandom.bool(0.1))
			&& me.getBreath() >= 7) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK);
		}

		if (me.getBreath() > 4
			&& me.getEnergy() < (me.getMaxEnergy() * 0.9)
			&& RandomUtils.crowniclesRandom.bool(0.9)
			&& this.restCount < 4) {
			this.restCount++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
		}

		return simpleOrQuickAttack(me, opponent);
	}
}

export default HorseRiderFightBehavior;
