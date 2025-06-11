import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightEndOfFightPacket extends CrowniclesPacket {
	winner!: {
		keycloakId?: string;
		monsterId?: string;
		finalEnergy: number;
		maxEnergy: number;
	};

	looser!: {
		keycloakId?: string;
		monsterId?: string;
		finalEnergy: number;
		maxEnergy: number;
	};

	draw!: boolean;

	turns!: number;

	maxTurns!: number;
}
