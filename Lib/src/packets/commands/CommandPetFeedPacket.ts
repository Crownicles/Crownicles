import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";

export enum CommandPetFeedResult {
	HAPPY = "happy",
	VERY_HAPPY = "veryHappy",
	VERY_VERY_HAPPY = "veryVeryHappy",
	DISLIKE = "dislike"
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetFeedPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFeedNoPetErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFeedPetOnExpeditionErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFeedNotHungryErrorPacket extends CrowniclesPacket {
	pet!: OwnedPet;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFeedNoMoneyFeedErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFeedGuildStorageEmptyErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFeedCancelErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFeedSuccessPacket extends CrowniclesPacket {
	result!: CommandPetFeedResult;
}
