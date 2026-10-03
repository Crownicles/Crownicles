import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	FightFighterSnapshot, FightStatusSnapshot
} from "../../types/FightStatusSnapshot";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightStatusPacket extends CrowniclesPacket implements FightStatusSnapshot {
	fightId!: string;

	numberOfTurn!: number;

	maxNumberOfTurn!: number;

	activeFighter!: FightFighterSnapshot;

	defendingFighter!: FightFighterSnapshot;
}
