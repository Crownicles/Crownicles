import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { FightActionType } from "../../../Lib/src/types/FightActionType";
import { Fighter } from "../core/fights/fighter/Fighter";
import { FightController } from "../core/fights/FightController";
import { FightActionResult } from "../../../Lib/src/types/FightActionResult";
import { importCompiledFolderExports } from "../core/utils/DynamicImportUtils";

export class FightAction extends Data<string> {
	public readonly breath!: number;

	public readonly missionVariant!: number;

	public readonly type!: FightActionType;

	private _weightForRandomSelection!: number;


	public use(sender: Fighter, receiver: Fighter, turn: number, fight: FightController): FightActionResult {
		const fightActionFunc = FightActionDataController.getFightActionFunction(this.id);
		if (!fightActionFunc) {
			throw new Error(`Fight action function not found for id: ${this.id}`);
		}
		const result = fightActionFunc(sender, receiver, this, turn, fight);

		FightAction.applyResistanceAndReflect(result, sender, receiver, this.type);
		receiver.damage(result.damages ?? 0);

		if (result.usedAction) {
			const usedAction = FightActionDataController.instance.getById(result.usedAction.id);
			if (usedAction) {
				FightAction.applyResistanceAndReflect(result.usedAction.result, sender, receiver, usedAction.type);
			}
			receiver.damage(result.usedAction.result.damages ?? 0);
		}

		return result;
	}

	private static applyResistanceAndReflect(result: FightActionResult, sender: Fighter, receiver: Fighter, type: FightActionType): void {
		if (result.damages === undefined) {
			return;
		}

		/*
		 * Attack/defense enchantments act as multipliers on the effective damage dealt (sender) and received (receiver),
		 * as well as the sender's damage bonuses limited to this type of action (e.g. the mammoth momentum on physical attacks)
		 */
		result.damages = Math.round(result.damages
			* sender.getEnchantmentDamageDealtMultiplier()
			* sender.getActionTypeDamageMultiplier(type)
			* receiver.getEnchantmentDamageTakenMultiplier());

		// originalDamages (used for reflected damage) is intentionally taken after the enchantment scaling above
		const originalDamages = result.damages;
		result.damages = Math.round(result.damages * receiver.getResistanceMultiplier(type));

		const reflectedDamage = receiver.getReflectedDamage(type, originalDamages);
		if (reflectedDamage > 0) {
			sender.damage(reflectedDamage);
			result.reflectedDamages = (result.reflectedDamages ?? 0) + reflectedDamage;
		}
	}

	/**
	 * Set the weight of the action for random selection
	 * @param weight
	 */
	public setWeightForRandomSelection(weight: number): void {
		this._weightForRandomSelection = weight;
	}


	public getWeightForRandomSelection(): number {
		return this._weightForRandomSelection;
	}
}

export type FightActionFunc = (sender: Fighter, receiver: Fighter, fightAction: FightAction, turn: number, fight: FightController) => FightActionResult;

type FightActionModule = {
	default: FightActionFunc;
};

function importFightActionsFunctions(folder: string): Promise<Map<string, FightActionFunc>> {
	return importCompiledFolderExports(folder, (fightActionModule: FightActionModule) => fightActionModule.default);
}


export class FightActionDataController extends DataControllerString<FightAction> {
	static readonly instance: FightActionDataController = new FightActionDataController("fightActions");

	private static fightActionsFunctionsCache: Map<string, FightActionFunc>;

	public static getFightActionBreathCost(id: string): number {
		const fightAction = this.instance.getById(id);
		if (fightAction) {
			return fightAction.breath;
		}
		throw new Error(`FightAction with id ${id} not found`);
	}

	public static async loadFightActionsFunctions(): Promise<void> {
		FightActionDataController.fightActionsFunctionsCache = new Map([
			...await importFightActionsFunctions("core/fights/actions/interfaces/players"),
			...await importFightActionsFunctions("core/fights/actions/interfaces/monsters")
		]);
	}

	public static getFightActionFunction(id: string): FightActionFunc | undefined {
		return FightActionDataController.fightActionsFunctionsCache.get(id);
	}

	newInstance(): FightAction {
		return new FightAction();
	}

	getNone(): FightAction {
		return this.getById("none")!;
	}

	getAllKeys(): IterableIterator<string> {
		return this.data.keys();
	}

	getListById(fightActionsIds: string[]): FightAction[] {
		const fightActions: FightAction[] = [];
		for (const fightActionId of fightActionsIds) {
			fightActions.push(this.getById(fightActionId)!);
		}
		return fightActions;
	}
}
