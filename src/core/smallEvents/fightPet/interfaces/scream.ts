import {FightPetAction} from "../FightPetAction";
import Player from "../../../database/game/models/Player";
import {FeralPet} from "../../../database/game/models/FeralPet";

/**
 *  Scream
 */
export default class Scream extends FightPetAction {
	public applyOutcome(player: Player, feralPet: FeralPet): boolean {
		// Succeeds 4/10 if the pet is masculine, 6/10 if the pet is feminine
		return Math.random() < (feralPet.isFemale ? 0.4 : 0.6);
	}
}