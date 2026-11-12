import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { FightView } from "../FightView";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { PlayerBaseFighter } from "../fighter/PlayerBaseFighter";
import { getUsedGodMoves } from "../FightController";
import PaladinFightBehavior from "./PaladinFightBehavior";
import { MAX_GOD_MOVES_PER_FIGHT } from "./PaladinTactics";

// The divine attack failure chance drops with the turns: from this turn it only misses one time out of five
const JUSTICAR_DIVINE_ATTACK_TURN = 11;

/*
 * The justicar keeps its ultimate for the end of the fight: charged later than by the crusader, it resists the knights
 * better, but leaves the gunners the time to wear it down
 */
const JUSTICAR_ULTIMATE_CHARGE_ENERGY_RATIO = 0.3;

/**
 * Justicar paladin: fights like the crusader, but keeps its ultimate for the end of the fight and strikes with the
 * divine attack as soon as it rarely misses
 */
class PaladinJusticarFightBehavior extends PaladinFightBehavior {
	protected override readonly ultimateChargeEnergyRatio = JUSTICAR_ULTIMATE_CHARGE_ENERGY_RATIO;

	override chooseAction(me: AiPlayerFighter, fightView: FightView): FightAction {
		const opponent = fightView.fightController.getDefendingFighter() as PlayerBaseFighter;
		const divineAttackAvailable = getUsedGodMoves(me, opponent) < MAX_GOD_MOVES_PER_FIGHT
			&& me.getBreath() >= FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK);
		if (fightView.fightController.turn >= JUSTICAR_DIVINE_ATTACK_TURN && divineAttackAvailable) {
			return FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DIVINE_ATTACK)!;
		}
		return super.chooseAction(me, fightView);
	}
}

export default PaladinJusticarFightBehavior;
