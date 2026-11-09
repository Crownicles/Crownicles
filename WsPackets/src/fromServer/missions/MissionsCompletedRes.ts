import { FromServerPacket } from "../FromServerPacket";
import {
	CompletedMission, Mission
} from "../../objects/Mission";
import { RecipeDisplay } from "../../objects/RecipeDisplay";

/** Pushed when an action completes missions; their rewards are already credited. */
export class MissionsCompletedRes extends FromServerPacket {
	public static readonly wireName = "MissionsCompletedRes";

	public missions!: CompletedMission[];

	public nextCampaignMission?: Mission;

	public discoveredRecipes?: RecipeDisplay[];
}
