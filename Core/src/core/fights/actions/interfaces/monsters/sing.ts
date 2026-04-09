import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleAlterationFightAction } from "../../templates/SimpleAlterationFightActionTemplate";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";

const use: FightActionFunc = (_sender, receiver, _fightAction) => {
	const usedDistance = receiver.getLastFightActionUsed()?.type === FightActionType.DISTANCE;

	const result = simpleAlterationFightAction(receiver, {
		selfTarget: false,
		alteration: usedDistance
			? RandomUtils.crowniclesRandom.bool(0.35) ? FightAlterations.SLEEPING : FightAlterations.CONFUSED
			: RandomUtils.crowniclesRandom.bool(0.65) ? FightAlterations.SLEEPING : FightAlterations.CONFUSED
	});

	return {
		...result,
		customMessage: true
	};
};

export default use;
