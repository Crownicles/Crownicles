import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildDailyPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDailyRewardPacket extends CrowniclesPacket {
	guildName!: string;

	pet?: {
		typeId: number;
		isFemale: boolean;
	};

	money?: number;

	fullHeal?: boolean;

	heal?: number;

	alteration?: { healAmount?: number };

	personalXp?: number;

	guildXp?: number;

	commonFood?: number;

	badge?: boolean;

	advanceTime?: number;

	superBadge?: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDailyCooldownErrorPacket extends CrowniclesPacket {
	totalTime!: number;

	remainingTime!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDailyPveIslandErrorPacket extends CrowniclesPacket {}
