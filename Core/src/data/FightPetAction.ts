import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import Player from "../core/database/game/models/Player";
import { readdirSync } from "fs";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { Pet } from "./Pet";
import { PlayerActiveObjects } from "../core/database/game/models/PlayerActiveObjects";

/**
 * The base class for the different events that can happen after the player encounters a feral pet
 */
export class FightPetAction extends Data<string> {
	public applyOutcomeFightPetAction(player: Player, pet: Pet, isFemale: boolean, playerActiveObjects: PlayerActiveObjects): boolean | Promise<boolean> {
		return FightPetActionDataController.getFightPetActionFunction(this.id)(player, pet, isFemale, playerActiveObjects);
	}
}

export type FightPetActionFunc = (player: Player, pet: Pet, isFemale: boolean, playerActiveObjects: PlayerActiveObjects) => boolean | Promise<boolean>;

export class FightPetActionDataController extends DataControllerString<FightPetAction> {
	static readonly instance = new FightPetActionDataController("fightPetActions");

	private static fightPetActionsFunctionsCache: Map<string, FightPetActionFunc>;

	public static getFightPetActionFunction(id: string): FightPetActionFunc {
		if (!FightPetActionDataController.fightPetActionsFunctionsCache) {
			FightPetActionDataController.fightPetActionsFunctionsCache = new Map<string, FightPetActionFunc>();
			FightPetActionDataController.loadFightPetActionsFromFolder("dist/Core/src/core/smallEvents/fightPet", "../core/smallEvents/fightPet");
		}
		return FightPetActionDataController.fightPetActionsFunctionsCache.get(id);
	}

	private static loadFightPetActionsFromFolder(path: string, relativePath: string): void {
		const files = readdirSync(path);
		for (const file of files) {
			if (file.endsWith(".js")) {
				const defaultFunc = require(`${relativePath}/${file.substring(0, file.length - 3)}`).fightPetAction;
				const fightPetActionName = file.substring(0, file.length - 3);
				FightPetActionDataController.fightPetActionsFunctionsCache.set(fightPetActionName, defaultFunc);
			}
		}
	}

	public getRandomFightPetAction(excludedFightPetActions: FightPetAction[]): FightPetAction {
		return RandomUtils.crowniclesRandom.pick(Array.from(this.data.values()).filter(fightPetAction => !excludedFightPetActions.includes(fightPetAction)));
	}

	newInstance(): FightPetAction {
		return new FightPetAction();
	}

	getNothing(): FightPetAction {
		return this.getById("doNothing");
	}
}
