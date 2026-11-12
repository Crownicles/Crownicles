import { DataControllerString } from "./DataController";
import { FightAction } from "./FightAction";
import { FightController } from "../core/fights/FightController";
import { Fighter } from "../core/fights/fighter/Fighter";
import type { PlayerBaseFighter } from "../core/fights/fighter/PlayerBaseFighter";
import { PetAssistanceResult } from "../../../Lib/src/types/PetAssistanceResult";
import { importCompiledFolderExports } from "../core/utils/DynamicImportUtils";

export class PetAssistance extends FightAction {
	public async execute(fighter: PlayerBaseFighter, opponent: Fighter, turn: number, fightController: FightController): Promise<PetAssistanceResult | null> {
		const result = await PetAssistanceDataController.getPetAssistanceFunction(this.id)(fighter, opponent, turn, fightController);
		if (!result) {
			return null;
		}
		opponent.damage(result.damages ?? 0);
		return result;
	}
}

/**
 * Only the player fighters (human, AI or king guard) have a pet assisting them
 */
export type PetAssistanceFunc = (affected: PlayerBaseFighter, opponent: Fighter, turn: number, fight: FightController) => Promise<PetAssistanceResult | null>;

type PetAssistanceModule = {
	default: PetAssistanceFunc;
};

export class PetAssistanceDataController extends DataControllerString<PetAssistance> {
	static readonly instance: PetAssistanceDataController = new PetAssistanceDataController("fightActions");

	private static petAssistanceFunctionsCache: Map<string, PetAssistanceFunc>;

	public static async loadPetAssistancesFunctions(): Promise<void> {
		PetAssistanceDataController.petAssistanceFunctionsCache = await importCompiledFolderExports(
			"core/fights/actions/interfaces/pets",
			(petAssistanceModule: PetAssistanceModule) => petAssistanceModule.default
		);
	}

	public static getPetAssistanceFunction(id: string): PetAssistanceFunc {
		return PetAssistanceDataController.petAssistanceFunctionsCache.get(id)!;
	}

	newInstance(): PetAssistance {
		return new PetAssistance();
	}
}
