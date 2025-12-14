import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { PostFightPetReactionType } from "../../constants/PetConstants";

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

	winnerKeycloakId?: string;

	petLoveChange?: {
		keycloakId: string;
		loveChange: number;
		reactionType: PostFightPetReactionType;
		petId: number;
		petSex: string;
		petNickname: string | null;
	};
}
