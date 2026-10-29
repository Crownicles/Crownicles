import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { RestingKnightFightBehavior } from "./RestingKnightFightBehavior";
import { canUseGodMove } from "./KnightGodMoves";

// The benediction buff grows with the turn, so the enduring knight waits for one of these turns to cast it
const LATE_BENEDICTION_TURN = {
	MIN: 13,
	MAX: 16
};

/**
 * Enduring knight: heals as soon as it is hurt, keeps the benediction for its strongest buff late in the fight
 * (unless the opponent could take the shared god move first) and stalls the fights it cannot win anymore
 */
class KnightEnduringFightBehavior extends RestingKnightFightBehavior {
	protected readonly restEnergyRatio = 0.9;

	private readonly benedictionTurn = RandomUtils.rangedInt(LATE_BENEDICTION_TURN);

	protected shouldBless(_me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter, turn: number): boolean {
		return canUseGodMove(opponent) || turn >= this.benedictionTurn;
	}

	protected override shouldStall(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter): boolean {
		return me.getEnergy() < 150 && opponent.getEnergy() > 500;
	}
}

export default KnightEnduringFightBehavior;
