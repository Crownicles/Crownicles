import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightActionDataController } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { getUsedGodMoves } from "../FightController";

/**
 * Check if a fighter can cast a god move (benediction or divine attack)
 * @param fighter
 */
export function canUseGodMove(fighter: AiPlayerFighter | RealPlayerFighter): boolean {
	return FightConstants.GOD_MOVES.some(godMove => fighter.availableFightActions.has(godMove));
}

/**
 * GOD MOVE RACE: the benediction and the divine attack share a single quota between both fighters, so against an
 * opponent able to cast one, the first fighter to cast it takes it from the other.
 * Check if the benediction is still free, affordable, and threatened by the opponent
 * @param me
 * @param opponent
 */
export function shouldWinGodMoveRace(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter): boolean {
	const canAffordBenediction = me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.BENEDICTION);
	return canUseGodMove(opponent) && getUsedGodMoves(me, opponent) < 1 && canAffordBenediction;
}
