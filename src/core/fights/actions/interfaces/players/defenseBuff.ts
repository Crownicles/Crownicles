import {Fighter, FightStatModifierOperation} from "../../../fighter/Fighter";
import {Translations} from "../../../../Translations";
import {FightAction} from "../../FightAction";

export default class DefenseBuff extends FightAction {
	use(sender: Fighter, receiver: Fighter, turn: number, language: string): string {
		const defenseBuffTranslationModule = Translations.getModule(`fightactions.${this.name}`, language);

		// amount of times the sender has used the move already in its 5 last moves
		const streak = sender.fightActionsHistory.slice(-3).filter(action => action instanceof DefenseBuff).length;

		const defenseBuffArray = [20, 25, 35, 40];

		sender.applyDefenseModifier({
			origin: this,
			operation: FightStatModifierOperation.ADDITION,
			value: sender.getDefense() * defenseBuffArray[streak] / 100 + 1
		});

		return defenseBuffTranslationModule.format("active", {
			amount: defenseBuffArray[streak]
		});
	}
}