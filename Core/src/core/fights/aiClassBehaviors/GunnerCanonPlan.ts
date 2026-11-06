import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;

// Number of canons fired in a row by a canon chain: each canon after a canon deals 50% more damage
const MAX_CHAINED_CANON_ATTACKS = 3;

// Below this share of energy, the opponent is finished with a cheap attack
const FINISHING_ENERGY_RATIO = 0.06;

// The intense attack is played against an opponent at least this fast compared with the gunner, and not about to fall
const INTENSE_ATTACK_MIN_SPEED_RATIO = 0.8;

const INTENSE_ATTACK_MIN_ENERGY_RATIO = 0.2;

function getAction(actionId: string): FightAction {
	return FightActionDataController.instance.getById(actionId)!;
}

function canAfford(me: AiPlayerFighter, actionId: string): boolean {
	return me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Cheap attack finishing an opponent with almost no energy left: the quick attack when faster, the sabotage otherwise
 * @param me
 * @param opponent
 */
function chooseFinishingMove(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter): FightAction {
	return getAction(canAfford(me, ACTIONS.QUICK_ATTACK) && me.getSpeed() > opponent.getSpeed() ? ACTIONS.QUICK_ATTACK : ACTIONS.SABOTAGE_ATTACK);
}

/**
 * Check if the intense attack is worth it: against an opponent nearly as fast as the gunner, and not about to fall
 * @param me
 * @param opponent
 */
function shouldUseIntenseAttack(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter): boolean {
	return opponent.getSpeed() > me.getSpeed() * INTENSE_ATTACK_MIN_SPEED_RATIO
		&& opponent.getEnergy() > opponent.getMaxEnergy() * INTENSE_ATTACK_MIN_ENERGY_RATIO
		&& canAfford(me, ACTIONS.INTENSE_ATTACK);
}

/**
 * Check if the gunner opens with the boomerang: on its first move, against an opponent without alteration
 * @param me
 * @param opponent
 * @param turn
 */
function shouldOpenWithBoomerang(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, turn: number): boolean {
	return turn <= 2 && !opponent.hasFightAlteration() && canAfford(me, ACTIONS.BOOMERANG_ATTACK);
}

/**
 * Canon plan of the gunners: the boomerang at the opening on a clean opponent, canon chains started once the breath is
 * close enough to its maximum, the intense attack against an opponent nearly as fast, and the cheap sabotage attack in
 * between, which lets the breath build up for the next chain
 */
export class GunnerCanonPlan {
	private chainedCanonAttacks = 0;

	/**
	 * @param breathMarginToStartChain A canon chain starts when the breath is at most this far from its maximum
	 */
	public constructor(private readonly breathMarginToStartChain: number) {}

	public chooseAction(me: AiPlayerFighter, opponent: RealPlayerFighter | AiPlayerFighter, turn: number): FightAction {
		const lastWasCanon = me.getLastFightActionUsed()?.id === ACTIONS.CANON_ATTACK;
		if (!lastWasCanon) {
			this.chainedCanonAttacks = 0;
		}
		if (opponent.getEnergy() <= opponent.getMaxEnergy() * FINISHING_ENERGY_RATIO) {
			return chooseFinishingMove(me, opponent);
		}
		if (shouldOpenWithBoomerang(me, opponent, turn)) {
			return getAction(ACTIONS.BOOMERANG_ATTACK);
		}
		const canonChainLength = this.getCanonChainLengthIfFired(me, lastWasCanon);
		if (canonChainLength !== null) {
			this.chainedCanonAttacks = canonChainLength;
			return getAction(ACTIONS.CANON_ATTACK);
		}
		return getAction(shouldUseIntenseAttack(me, opponent) ? ACTIONS.INTENSE_ATTACK : ACTIONS.SABOTAGE_ATTACK);
	}

	/**
	 * Length of the canon chain if the gunner fires a canon now: to continue its chain, or to start a new one with a nearly
	 * full breath. Null when it does not fire
	 * @param me
	 * @param lastWasCanon
	 */
	private getCanonChainLengthIfFired(me: AiPlayerFighter, lastWasCanon: boolean): number | null {
		if (!canAfford(me, ACTIONS.CANON_ATTACK)) {
			return null;
		}
		if (lastWasCanon && this.chainedCanonAttacks < MAX_CHAINED_CANON_ATTACKS) {
			return this.chainedCanonAttacks + 1;
		}
		return me.getBreath() >= me.getMaxBreath() - this.breathMarginToStartChain ? 1 : null;
	}
}
