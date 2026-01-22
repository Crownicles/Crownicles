import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightHistoryItemPacket extends CrowniclesPacket {
	fightId!: string;

	fighterKeycloakId?: string;

	monsterId?: string;

	fightActionId!: string;

	usedFightActionId?: string; // Sometimes a fight action is used by another one

	customMessage?: boolean; // True if the fight action has an associated custom message instead of the default (only for attacks)

	status?: string; // See constants in FightAlterationResult or FightActionStatus for values

	pet?: OwnedPet;

	fightActionEffectDealt?: { // Stat change for the opponent in % (10 = 10%) can be negative
		newAlteration?: string;
		damages?: number;
		reflectedDamages?: number; // Dégâts renvoyés à l'attaquant
		defense?: number;
		attack?: number;
		speed?: number;
		breath?: number; // This one is not in %
	};

	fightActionEffectReceived?: { // Stat change for the fighter in % (10 = 10%) can be negative
		newAlteration?: string;
		damages?: number;
		defense?: number;
		attack?: number;
		speed?: number;
		breath?: number; // This one is not in %
	};
}
