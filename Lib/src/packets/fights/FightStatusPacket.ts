import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightStatusPacket extends CrowniclesPacket {
	fightId!: string;

	numberOfTurn!: number;

	maxNumberOfTurn!: number;

	activeFighter!: {
		keycloakId?: string;
		monsterId?: string;
		classId?: number;
		level?: number;
		alteration?: string;
		glory?: number;
		stats: {
			power: number;
			maxEnergy?: number;
			attack: number;
			defense: number;
			speed: number;
			breath: number;
			maxBreath: number;
			breathRegen: number;
		};
	};

	defendingFighter!: {
		keycloakId?: string;
		monsterId?: string;
		classId?: number;
		level?: number;
		alteration?: string;
		glory?: number;
		stats: {
			power: number;
			maxEnergy?: number;
			attack: number;
			defense: number;
			speed: number;
			breath: number;
			maxBreath: number;
			breathRegen: number;
		};
	};
}
