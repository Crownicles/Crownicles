import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandUnlockPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

@sendablePacket(PacketDirection.NONE)
export class CommandUnlockErrorPacket extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandUnlockNoPlayerFound extends CommandUnlockErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandUnlockNotInJail extends CommandUnlockErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandUnlockNotEnoughMoney extends CommandUnlockErrorPacket {
	money!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandUnlockHimself extends CommandUnlockErrorPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandUnlockAcceptPacketRes extends CrowniclesPacket {
	unlockedKeycloakId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandUnlockRefusePacketRes extends CrowniclesPacket {

}
