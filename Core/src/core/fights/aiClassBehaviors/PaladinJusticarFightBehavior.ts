import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { getUsedGodMoves } from "../FightController";
import PaladinFightBehavior from "./PaladinFightBehavior";
import { MAX_GOD_MOVES_PER_FIGHT } from "./PaladinTactics";

// The divine attack failure chance drops with the turns: from this turn it only misses one time out of five
const JUSTICAR_DIVINE_ATTACK_TURN = 11;

/**
 * Justicar paladin: fights like the crusader, but strikes with the divine attack as soon as it rarely misses
 */
class PaladinJusticarFightBehavior extends PaladinFightBehavior {
	override chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as RealPlayerFighter | AiPlayerFighter;
		const divineAttackAvailable = getUsedGodMoves(me, opponent) < MAX_GOD_MOVES_PER_FIGHT
			&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK);
		if (fightView.fightController.turn >= JUSTICAR_DIVINE_ATTACK_TURN && divineAttackAvailable) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK)!;
		}
		return super.chooseAction(me, fightView);
	}
}

export default PaladinJusticarFightBehavior;
