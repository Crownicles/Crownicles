import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class FightRewardPacket extends CrowniclesPacket {
	points!: number;

	money!: number;

	player1!: {
		keycloakId: string;
		oldGlory: number;
		newGlory: number;
		oldLeagueId: number;
		newLeagueId: number;
	};

	player2!: {
		keycloakId: string;
		oldGlory: number;
		newGlory: number;
		oldLeagueId: number;
		newLeagueId: number;
	};

	draw!: boolean;
}
