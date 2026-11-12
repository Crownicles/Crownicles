import { DataControllerString } from "./DataController";
import { FightAction } from "./FightAction";
import { FightController } from "../core/fights/FightController";
import { Fighter } from "../core/fights/fighter/Fighter";
import { FightAlterationResult } from "../../../Lib/src/types/FightAlterationResult";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { importCompiledFolderExports } from "../core/utils/DynamicImportUtils";

export class FightAlteration extends FightAction {
	public happen(affected: Fighter, opponent: Fighter, turn: number, fight: FightController): FightAlterationResult {
		if (this.id !== FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH) { // Out of breath is not a real alteration
			affected.alterationTurn++;
		}
		const result = FightAlterationDataController.getFightAlterationFunction(this.id)(affected, this, opponent, turn, fight);

		/*
		 * The armor defense enchantment reduces the effective damage received, including damage-over-time.
		 * A weapon damage enchantment additionally resists the opposite element's alteration (e.g. fire resists frozen).
		 * `&&=` leaves a non-damage alteration's undefined `damages` untouched (avoids NaN and a spurious 0-damage line).
		 */
		result.damages &&= Math.round(result.damages * affected.getEnchantmentDamageTakenMultiplier() * affected.getAlterationResistanceMultiplier(this.id));

		affected.damage(result.damages ?? 0);
		return result;
	}
}

export type FightAlterationFunc = (affected: Fighter, fightAlteration: FightAlteration, opponent: Fighter, turn: number, fight: FightController) => FightAlterationResult;

type FightAlterationModule = {
	default: FightAlterationFunc;
};

export class FightAlterationDataController extends DataControllerString<FightAlteration> {
	static readonly instance: FightAlterationDataController = new FightAlterationDataController("fightActions");

	private static fightAlterationsFunctionsCache: Map<string, FightAlterationFunc>;

	public static async loadFightAlterationsFunctions(): Promise<void> {
		FightAlterationDataController.fightAlterationsFunctionsCache = await importCompiledFolderExports(
			"core/fights/actions/interfaces/alterations",
			(fightAlterationModule: FightAlterationModule) => fightAlterationModule.default
		);
	}

	public static getFightAlterationFunction(id: string): FightAlterationFunc {
		return FightAlterationDataController.fightAlterationsFunctionsCache.get(id)!;
	}

	newInstance(): FightAlteration {
		return new FightAlteration();
	}
}
