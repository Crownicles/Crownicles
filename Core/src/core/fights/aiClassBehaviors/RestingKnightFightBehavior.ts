import { ClassBehavior } from "../AiBehaviorController";
import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { getUsedGodMoves } from "../FightController";

// Rests heal less after this many uses, so the knight stops resting
const MAX_RESTS = 4;

// Resting is pointless against an opponent this close to death
const MIN_OPPONENT_ENERGY_TO_REST = 250;

function canAfford(me: AiPlayerFighter, actionId: string): boolean {
	return me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Knight personality built around the rest then heavy attack combo: the heavy attack is only fully effective right after a rest.
 * Personalities differ by when they cast the benediction and by how hurt they must be to rest.
 */
export abstract class RestingKnightFightBehavior implements ClassBehavior {
	private restCount = 0;

	/**
	 * Energy ratio under which the knight rests to prepare a heavy attack
	 */
	protected abstract readonly restEnergyRatio: number;

	/**
	 * Check if the knight casts its benediction now (the shared god move quota and the breath are already checked)
	 * @param me
	 * @param opponent
	 * @param turn
	 */
	protected abstract shouldBless(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter, turn: number): boolean;

	/**
	 * Check if the knight should rest no matter what, to stall a fight it cannot win anymore
	 * @param _me
	 * @param _opponent
	 */
	protected shouldStall(_me: AiPlayerFighter, _opponent: AiPlayerFighter | RealPlayerFighter): boolean {
		return false;
	}

	chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as AiPlayerFighter | RealPlayerFighter;
		const actions = FightConstants.FIGHT_ACTIONS.PLAYER;
		const getAction = (actionId: string): FightAction => FightActionDataController.instance.getById(actionId)!;

		if (this.canBlessNow(me, opponent, fightView.fightController.turn)) {
			return getAction(actions.BENEDICTION);
		}

		if (this.shouldStall(me, opponent)) {
			return getAction(actions.RESTING);
		}

		if (me.getLastFightActionUsed()?.id === actions.RESTING && canAfford(me, actions.HEAVY_ATTACK)) {
			return getAction(actions.HEAVY_ATTACK);
		}

		if (this.shouldRestBeforeHeavyAttack(me, opponent)) {
			this.restCount++;
			return getAction(actions.RESTING);
		}

		return me.getSpeed() > opponent.getSpeed() && canAfford(me, actions.QUICK_ATTACK)
			? getAction(actions.QUICK_ATTACK)
			: getAction(actions.SIMPLE_ATTACK);
	}

	/**
	 * The benediction is still available in the fight, affordable, and the personality wants it now
	 */
	private canBlessNow(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter, turn: number): boolean {
		return getUsedGodMoves(me, opponent) < 1
			&& canAfford(me, FightConstants.FIGHT_ACTIONS.PLAYER.BENEDICTION)
			&& this.shouldBless(me, opponent, turn);
	}

	/**
	 * Rest when hurt enough, only if the breath regenerated meanwhile allows the heavy attack right after
	 */
	private shouldRestBeforeHeavyAttack(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter): boolean {
		const heavyAttackCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK);
		const restWillPayOff = me.getBreath() + me.getRegenBreath() >= heavyAttackCost && opponent.getEnergy() > MIN_OPPONENT_ENERGY_TO_REST;
		return me.getEnergy() < me.getMaxEnergy() * this.restEnergyRatio
			&& this.restCount < MAX_RESTS
			&& restWillPayOff;
	}
}
