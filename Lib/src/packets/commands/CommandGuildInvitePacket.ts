import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket.js";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildInvitePacketReq extends CrowniclesPacket {
	invitedPlayerKeycloakId!: string;
}

@sendablePacket(PacketDirection.NONE)
export class CommandGuildInviteErrorPacket extends CrowniclesPacket {
	invitedPlayerKeycloakId!: string;

	guildName!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInvitePlayerNotFound extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInviteInvitingPlayerNotInGuild extends CommandGuildInviteErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInviteLevelTooLow extends CommandGuildInviteErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInviteGuildIsFull extends CommandGuildInviteErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInviteInvitedPlayerIsDead extends CommandGuildInviteErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInviteInvitedPlayerIsOnPveIsland extends CommandGuildInviteErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInviteAlreadyInAGuild extends CommandGuildInviteErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInviteAcceptPacketRes extends CrowniclesPacket {
	invitedPlayerKeycloakId!: string;

	guildName!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildInviteRefusePacketRes extends CrowniclesPacket {
	invitedPlayerKeycloakId!: string;

	guildName!: string;
}
