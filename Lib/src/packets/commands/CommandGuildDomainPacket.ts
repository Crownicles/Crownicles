import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { GuildBuilding } from "../../constants/GuildDomainConstants";

export class BuildingInfo {
	building!: GuildBuilding;

	level!: number;

	maxLevel!: number;

	upgradeCost!: number | null;

	requiredGuildLevel!: number | null;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildDomainPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDomainPacketRes extends CrowniclesPacket {
	guildName!: string;

	guildLevel!: number;

	treasury!: number;

	buildings!: BuildingInfo[];
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildDomainUpgradePacketReq extends CrowniclesPacket {
	building!: GuildBuilding;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDomainUpgradeSuccessPacket extends CrowniclesPacket {
	building!: GuildBuilding;

	newLevel!: number;

	cost!: number;

	remainingTreasury!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDomainUpgradeMaxLevelPacket extends CrowniclesPacket {
	building!: GuildBuilding;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDomainUpgradeNotEnoughTreasuryPacket extends CrowniclesPacket {
	building!: GuildBuilding;

	cost!: number;

	treasury!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDomainUpgradeGuildLevelTooLowPacket extends CrowniclesPacket {
	building!: GuildBuilding;

	requiredGuildLevel!: number;

	currentGuildLevel!: number;
}
