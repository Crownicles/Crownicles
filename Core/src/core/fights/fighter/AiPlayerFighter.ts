import { Player } from "../../database/game/models/Player";
import { FightView } from "../FightView";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { Class } from "../../../data/Class";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ClassBehavior, getAiClassBehavior
} from "../AiBehaviorController";
import { PlayerFighter } from "./PlayerFighter";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

/**
 * Fighter
 * Class representing a player in a fight
 */
export class AiPlayerFighter extends PlayerFighter {
	public consumePotionProbability = FightConstants.POTION_NO_DRINK_PROBABILITY.AI;

	private readonly classBehavior: ClassBehavior;

	public constructor(player: Player, playerClass: Class) {
		super(player, playerClass);
		this.classBehavior = getAiClassBehavior(playerClass.id);
	}

	/**
	 * Send the embed to choose an action
	 * @param fightView
	 * @param response
	 */
	async chooseAction(fightView: FightView, response: CrowniclesPacket[]): Promise<void> {
		fightView.displayAiChooseAction(response, RandomUtils.randInt(800, 2500));

		const classBehavior = this.classBehavior;

		// Use the behavior script to choose an action
		let fightAction: FightAction;

		if (classBehavior) {
			fightAction = classBehavior.chooseAction(this, fightView);
		}
		else {
			// Fallback to a simple attack if no behavior is defined
			fightAction = FightActionDataController.instance.getById("simpleAttack");
		}
		await fightView.fightController.executeFightAction(fightAction, true, response);
	}

	endFight(): Promise<void> {
		return Promise.resolve();
	}

	unblock(): void {
		// Not needed for AI players, they are not blocked during the fight
	}
}
