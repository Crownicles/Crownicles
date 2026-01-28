import { DataControllerString } from "./DataController";
import { readdirSync } from "fs";
import { FightAction } from "./FightAction";
import { FightController } from "../core/fights/FightController";
import { Fighter } from "../core/fights/fighter/Fighter";
import { PetAssistanceResult } from "../../../Lib/src/types/PetAssistanceResult";

export class PetAssistance extends FightAction {
	public async execute(fighter: Fighter, opponent: Fighter, turn: number, fightController: FightController): Promise<PetAssistanceResult | null> {
		const result = await PetAssistanceDataController.getPetAssistanceFunction(this.id)(fighter, opponent, turn, fightController);
		if (!result) {
			return null;
		}
		opponent.damage(result.damages ?? 0);
		return result;
	}
}

export type PetAssistanceFunc = (affected: Fighter, opponent: Fighter, turn: number, fight: FightController) => Promise<PetAssistanceResult | null>;

export class PetAssistanceDataController extends DataControllerString<PetAssistance> {
	static readonly instance: PetAssistanceDataController = new PetAssistanceDataController("fightActions");

	private static petAssistanceFunctionsCache: Map<string, PetAssistanceFunc>;

	public static getPetAssistanceFunction(id: string): PetAssistanceFunc {
		if (!PetAssistanceDataController.petAssistanceFunctionsCache) {
			PetAssistanceDataController.petAssistanceFunctionsCache = new Map<string, PetAssistanceFunc>();
			PetAssistanceDataController.loadPetAssistancesFromFolder("dist/Core/src/core/fights/actions/interfaces/pets", "../core/fights/actions/interfaces/pets");
		}

		return PetAssistanceDataController.petAssistanceFunctionsCache.get(id)!;
	}

	private static loadPetAssistancesFromFolder(path: string, relativePath: string): void {
		const files = readdirSync(path);
		for (const file of files) {
			if (file.endsWith(".js")) {
				const defaultFunc = require(`${relativePath}/${file.substring(0, file.length - 3)}`).default;
				const petAssistanceName = file.substring(0, file.length - 3);
				PetAssistanceDataController.petAssistanceFunctionsCache.set(petAssistanceName, defaultFunc);
			}
		}
	}

	newInstance(): PetAssistance {
		return new PetAssistance();
	}
}
