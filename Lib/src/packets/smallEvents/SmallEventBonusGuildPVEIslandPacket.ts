import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

export const SmallEventBonusGuildPVEIslandEmote = {
	EXPERIENCE: "xp",
	GUILD_POINTS: "guildPoint",
	LOST_HEALTH: "lostHealth",
	LOST_MONEY: "lostMoney"
} as const;

export type SmallEventBonusGuildPVEIslandEmote = typeof SmallEventBonusGuildPVEIslandEmote[keyof typeof SmallEventBonusGuildPVEIslandEmote];

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventBonusGuildPVEIslandPacket extends SmallEventPacket {
	event!: number;

	result!: SmallEventBonusGuildPVEIslandResultType;

	surrounding!: SmallEventBonusGuildPVEIslandOutcomeSurrounding;

	amount!: number;

	isExperienceGain!: boolean;

	emoteKey!: SmallEventBonusGuildPVEIslandEmote;
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
