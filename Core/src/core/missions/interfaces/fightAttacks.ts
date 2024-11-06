import {IMission} from "../IMission";
import {RandomUtils} from "../../../../../Lib/src/utils/RandomUtils";
import {FightActionController} from "../../fights/actions/FightActionController";
import {ClassDataController} from "../../../data/Class";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndSave: (variant, params) => params.attackType === FightActionController.variantToFightActionId(variant),

	generateRandomVariant: (difficulty, player) => FightActionController.fightActionIdToVariant(RandomUtils.draftbotRandom.pick(ClassDataController.instance.getById(player.class).fightActionsIds)),

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};