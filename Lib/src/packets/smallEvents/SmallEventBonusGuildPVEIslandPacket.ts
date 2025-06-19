import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventBonusGuildPVEIslandPacket extends SmallEventPacket {
	event!: number;

	result!: SmallEventBonusGuildPVEIslandResultType;

	surrounding!: SmallEventBonusGuildPVEIslandOutcomeSurrounding;

	amount!: number;

	isExperienceGain!: boolean;
}

export enum SmallEventBonusGuildPVEIslandOutcomeSurrounding {
	WITH_GUILD = "withGuild",
	SOLO_WITH_GUILD = "soloWithGuild",
	SOLO = "solo"
}


export enum SmallEventBonusGuildPVEIslandResultType {
	SUCCESS = "success",
	ESCAPE = "escape",
	LOSE = "lose"
}
