import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { PostFightPetReactionType } from "../../constants/PetConstants";

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

	petReaction?: {
		keycloakId: string;
		reactionType: PostFightPetReactionType;
		loveDelta: number;
		petId: number;
		petSex: string;
		petNickname: string | null;
	};
}
