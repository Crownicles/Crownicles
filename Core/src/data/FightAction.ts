import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { FightActionType } from "../../../Lib/src/types/FightActionType";
import { Fighter } from "../core/fights/fighter/Fighter";
import { readdirSync } from "fs";
import { FightController } from "../core/fights/FightController";
import { FightActionResult } from "../../../Lib/src/types/FightActionResult";

export class FightAction extends Data<string> {
	public readonly breath: number;

	public readonly missionVariant: number;

	public readonly type: FightActionType;

	private _weightForRandomSelection: number;


	public use(sender: Fighter, receiver: Fighter, turn: number, fight: FightController): FightActionResult {
		const result = FightActionDataController.getFightActionFunction(this.id)(sender, receiver, this, turn, fight);

		// Apply resistance multiplier to damages
		if (result.damages !== undefined) {
			const originalDamages = result.damages;
			const resistanceMultiplier = receiver.getResistanceMultiplier(this.type);
			result.damages = Math.round(result.damages * resistanceMultiplier);

			// Check if damage should be reflected
			const reflectedDamage = receiver.getReflectedDamage(this.type, originalDamages);
			if (reflectedDamage > 0) {
				sender.damage(reflectedDamage);
				if (!result.reflectedDamages) {
					result.reflectedDamages = 0;
				}
				result.reflectedDamages += reflectedDamage;
			}
		}

		receiver.damage(result.damages);

		if (result.usedAction) {
			// Get the type of the used action
			const usedAction = FightActionDataController.instance.getById(result.usedAction.id);
			if (result.usedAction.result.damages !== undefined) {
				const originalUsedActionDamages = result.usedAction.result.damages;
				const usedActionResistanceMultiplier = receiver.getResistanceMultiplier(usedAction.type);
				result.usedAction.result.damages = Math.round(result.usedAction.result.damages * usedActionResistanceMultiplier);

				// Check if damage should be reflected for used action
				const reflectedUsedActionDamage = receiver.getReflectedDamage(usedAction.type, originalUsedActionDamages);
				if (reflectedUsedActionDamage > 0) {
					sender.damage(reflectedUsedActionDamage);
					if (!result.usedAction.result.reflectedDamages) {
						result.usedAction.result.reflectedDamages = 0;
					}
					result.usedAction.result.reflectedDamages += reflectedUsedActionDamage;
				}
			}
			receiver.damage(result.usedAction.result.damages);
		}

		return result;
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

	public static getFightActionFunction(id: string): FightActionFunc {
		if (!FightActionDataController.fightActionsFunctionsCache) {
			FightActionDataController.fightActionsFunctionsCache = new Map<string, FightActionFunc>();
			FightActionDataController.loadFightActionsFromFolder("dist/Core/src/core/fights/actions/interfaces/players", "../core/fights/actions/interfaces/players");
			FightActionDataController.loadFightActionsFromFolder("dist/Core/src/core/fights/actions/interfaces/monsters", "../core/fights/actions/interfaces/monsters");
		}

		return FightActionDataController.fightActionsFunctionsCache.get(id);
	}

	private static loadFightActionsFromFolder(path: string, relativePath: string): void {
		const files = readdirSync(path);
		for (const file of files) {
			if (file.endsWith(".js")) {
				const defaultFunc = require(`${relativePath}/${file.substring(0, file.length - 3)}`).default;
				const fightActionName = file.substring(0, file.length - 3);
				FightActionDataController.fightActionsFunctionsCache.set(fightActionName, defaultFunc);
			}
		}
	}

	newInstance(): FightAction {
		return new FightAction();
	}

	getNone(): FightAction {
		return this.getById("none");
	}

	getAllKeys(): IterableIterator<string> {
		return this.data.keys();
	}

	getListById(fightActionsIds: string[]): FightAction[] {
		const fightActions: FightAction[] = [];
		for (const fightActionId of fightActionsIds) {
			fightActions.push(this.getById(fightActionId));
		}
		return fightActions;
	}
}
