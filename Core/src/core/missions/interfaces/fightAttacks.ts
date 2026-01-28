import { IMission } from "../IMission";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { FightActionController } from "../../fights/actions/FightActionController";
import { ClassDataController } from "../../../data/Class";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: (variant, params) => params.attackType === FightActionController.variantToFightActionId(variant),

	generateRandomVariant: (_difficulty, player) =>
		FightActionController.fightActionIdToVariant(
			RandomUtils.crowniclesRandom.pick(ClassDataController.instance.getById(player.class)!.fightActionsIds)
		),

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
