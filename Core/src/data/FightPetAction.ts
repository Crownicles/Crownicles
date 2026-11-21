import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import Player from "../core/database/game/models/Player";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { Pet } from "./Pet";
import { PlayerActiveObjects } from "../core/database/game/models/PlayerActiveObjects";
import { importCompiledFolderExports } from "../core/utils/DynamicImportUtils";

/**
 * The base class for the different events that can happen after the player encounters a feral pet
 */
export class FightPetAction extends Data<string> {
	public applyOutcomeFightPetAction(player: Player, pet: Pet, isFemale: boolean, playerActiveObjects: PlayerActiveObjects): boolean | Promise<boolean> {
		return FightPetActionDataController.getFightPetActionFunction(this.id)(player, pet, isFemale, playerActiveObjects);
	}
}

export type FightPetActionFunc = (player: Player, pet: Pet, isFemale: boolean, playerActiveObjects: PlayerActiveObjects) => boolean | Promise<boolean>;

type FightPetActionModule = {
	fightPetAction: FightPetActionFunc;
};

export class FightPetActionDataController extends DataControllerString<FightPetAction> {
	static readonly instance = new FightPetActionDataController("fightPetActions");

	private static fightPetActionsFunctionsCache: Map<string, FightPetActionFunc>;

	public static async loadFightPetActionsFunctions(): Promise<void> {
		FightPetActionDataController.fightPetActionsFunctionsCache = await importCompiledFolderExports(
			"core/smallEvents/fightPet",
			(fightPetActionModule: FightPetActionModule) => fightPetActionModule.fightPetAction
		);
	}

	public static getFightPetActionFunction(id: string): FightPetActionFunc {
		return FightPetActionDataController.fightPetActionsFunctionsCache.get(id)!;
	}

	public getRandomFightPetAction(excludedFightPetActions: FightPetAction[]): FightPetAction {
		return RandomUtils.crowniclesRandom.pick(Array.from(this.data.values()).filter(fightPetAction => !excludedFightPetActions.includes(fightPetAction)));
	}

	newInstance(): FightPetAction {
		return new FightPetAction();
	}

	getNothing(): FightPetAction {
		return this.getById("doNothing")!;
	}
}
