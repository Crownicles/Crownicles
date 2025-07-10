import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { getUsedGodMoves } from "../FightController";
import { simpleOrQuickAttack } from "./EsquireFightBehavior";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { PlayerFighter } from "../fighter/PlayerFighter";

class KnightFightBehavior implements ClassBehavior {
	private blessRoundChosen: number | null = null;

	private blessUsed = false;

	private restCount = 0;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | PlayerFighter;
		const currentRound = fightView.fightController.turn;

		// Initialize defense tracking on first round
		if (currentRound <= 2) {
			this.blessRoundChosen = RandomUtils.randInt(8, 14); // Choose when to use benediction
			this.restCount = 0; // Reset rest counter at the beginning of a fight
			this.blessUsed = false;
		}

		/*
		 * ENDGAME STRATEGY: Try to force a draw if victory seems impossible
		 * Still rest even if we've done it 4 times, because the goal is to stall
		 */
		if (me.getEnergy() < 150 && opponent.getEnergy() > 500) {
			this.restCount++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
		}

		// BENEDICTION STRATEGY
		const opponentIsPaladin = [
			ClassConstants.CLASSES_ID.PALADIN,
			ClassConstants.CLASSES_ID.LUMINOUS_PALADIN
		].includes(opponent.player.class);

		const shouldTryBless =
			!this.blessUsed && getUsedGodMoves(me, opponent) < 1 && (
				(currentRound >= this.blessRoundChosen)
				|| (opponentIsPaladin && me.player.class === ClassConstants.CLASSES_ID.KNIGHT && RandomUtils.crowniclesRandom.bool(0.3))
			);

		if (shouldTryBless) {
			// Not enough breath for benediction? Rest first (only if we haven't rested 4 times)
			if (me.getBreath() < 8) {
				if (this.restCount < 4) {
					this.blessRoundChosen += 2;
					this.restCount++;
					return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
				}

				// Otherwise, delay benediction but don't rest
				this.blessRoundChosen += 1;
			}

			this.blessUsed = true;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.BENEDICTION);
		}

		// REST WHEN NEEDED: Not enough breath for actions (only if we haven't rested 4 times)
		if (me.getBreath() < 2 && this.restCount < 4) {
			this.restCount++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
		}

		// Heavy attacks if the opponent has more defense and we have enough breath
		if (opponent.getDefense() > me.getDefense() && me.getBreath() >= 7) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK);
		}

		return simpleOrQuickAttack(me, opponent);
	}
}

export default KnightFightBehavior;
