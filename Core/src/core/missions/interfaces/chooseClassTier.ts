import { IMission } from "../IMission";
import { ClassDataController } from "../../../data/Class";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: (variant, params) => (params.tier as number) >= variant,

	generateRandomVariant: () => 0,

	initialNumberDone: (player, variant) => ClassDataController.instance.getById(player.class).classGroup >= variant ? 1 : 0,

	updateSaveBlob: () => null
};
