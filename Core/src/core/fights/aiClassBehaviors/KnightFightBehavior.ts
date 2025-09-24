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
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";

class KnightFightBehavior implements ClassBehavior {
	private blessRoundChosen: number | null = null;

	private blessUsed = false;

	private restCount = 0;

	private heavyAttackCount = 0;

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | RealPlayerFighter;
		const currentRound = fightView.fightController.turn;

		if (currentRound <= 2) {
			this.blessRoundChosen = RandomUtils.randInt(8, 14); // Choose when to use benediction
			this.restCount = 0;
			this.heavyAttackCount = 0;
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
				|| (opponentIsPaladin
					&& me.getLastFightActionUsed()?.id !== FightConstants.FIGHT_ACTIONS.PLAYER.RESTING // we don't want to break a resting + heavy combo
					&& RandomUtils.crowniclesRandom.bool(0.22))
			);

		if (shouldTryBless) {
			// Not enough breath for benediction? Rest instead
			if (me.getBreath() < 8) {
				if (this.restCount < 4) {
					this.restCount++;
					return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
				}
				return simpleOrQuickAttack(me, opponent);
			}

			this.blessUsed = true;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.BENEDICTION);
		}

		// HEAVY ATTACK STRATEGY: Use after resting or randomly (10% chance) if we have enough breath and haven't used it too often
		if (
			(
				(me.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
					|| RandomUtils.crowniclesRandom.bool(0.1))
				|| (this.restCount > 4 && this.heavyAttackCount < 3)
			)
			&& me.getBreath() >= 7
		) {
			this.heavyAttackCount++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK);
		}

		// REST STRATEGY: Rest if breath is above 4 but energy is below 90%, and we haven't rested too often
		if ((me.getBreath() > 10 || RandomUtils.crowniclesRandom.bool(0.2) || this.blessUsed)
			&& me.getBreath() >= 4
			&& opponent.getEnergy() > 250
			&& this.blessRoundChosen - 2 !== currentRound
			&& this.blessRoundChosen - 1 !== currentRound
			&& me.getEnergy() < (me.getMaxEnergy() * 0.9)
			&& RandomUtils.crowniclesRandom.bool(0.9)
			&& this.restCount < 4) {
			this.restCount++;
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.RESTING);
		}

		return simpleOrQuickAttack(me, opponent);
	}
}

export default KnightFightBehavior;
