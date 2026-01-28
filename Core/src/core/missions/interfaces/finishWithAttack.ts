import { IMission } from "../IMission";
import { FightActionController } from "../../fights/actions/FightActionController";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { ClassDataController } from "../../../data/Class";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: (variant, params) => params.lastAttack === FightActionController.variantToFightActionId(variant),

	generateRandomVariant: (_difficulty, player) =>
		FightActionController.fightActionIdToVariant(
			RandomUtils.crowniclesRandom.pick(ClassDataController.instance.getById(player.class)!.fightActionsIds)
		),

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
