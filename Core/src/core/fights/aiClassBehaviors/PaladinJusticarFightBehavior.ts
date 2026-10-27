import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { getUsedGodMoves } from "../FightController";
import PaladinFightBehavior from "./PaladinFightBehavior";

// The divine attack failure chance drops with the turns: from this turn it only misses one time out of five
const JUSTICAR_DIVINE_ATTACK_TURN = 11;

// The divine attack can be cast while fewer than this number of god moves were used in the fight
const MAX_GOD_MOVES_FOR_DIVINE_ATTACK = 2;

/**
 * Justicar paladin: fights like the crusader, but strikes with the divine attack as soon as it rarely misses
 */
class PaladinJusticarFightBehavior extends PaladinFightBehavior {
	override chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter;
		if (
			fightView.fightController.turn >= JUSTICAR_DIVINE_ATTACK_TURN
			&& getUsedGodMoves(me, opponent) < MAX_GOD_MOVES_FOR_DIVINE_ATTACK
			&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK)
		) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK)!;
		}
		return super.chooseAction(me, fightView);
	}
}

export default PaladinJusticarFightBehavior;
