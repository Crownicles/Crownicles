import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { TournamentCategory } from "../../types/Tournament";

type TournamentFightPlayerReward = {
	keycloakId: string;
	category: TournamentCategory;
	oldTotalGloryPoints: number;
	newTotalGloryPoints: number;
};

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class TournamentFightRewardPacket extends CrowniclesPacket {
	player1!: TournamentFightPlayerReward;

	player2!: TournamentFightPlayerReward;

	draw!: boolean;

	winnerKeycloakId?: string;
}
