import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleAlterationFightAction } from "../../templates/SimpleAlterationFightActionTemplate";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightActionFunc = (_sender, receiver) => simpleAlterationFightAction(receiver, {
	selfTarget: false,
	alteration: RandomUtils.crowniclesRandom.bool(0.65) ? FightAlterations.SLEEPING : FightAlterations.CONFUSED
});

export default use;
