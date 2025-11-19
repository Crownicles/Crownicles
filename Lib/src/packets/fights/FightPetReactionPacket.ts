import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";
import { PostFightPetReactionType } from "../../constants/PetConstants";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightPetReactionPacket extends CrowniclesPacket {
	fightId!: string;

	playerKeycloakId!: string;

	reactionType!: PostFightPetReactionType;

	loveDelta!: number;

	pet!: OwnedPet;
}
