import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetSellPacketReq extends CrowniclesPacket {
	price!: number;

	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellNoPetErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellPetOnExpeditionErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellNotInGuildErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellFeistyErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellBadPriceErrorPacket extends CrowniclesPacket {
	minPrice!: number;

	maxPrice!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellOnlyOwnerCanCancelErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellCancelPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellCantSellToYourselfErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellSameGuildError extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellAlreadyHavePetError extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellNotEnoughMoneyError extends CrowniclesPacket {
	missingMoney!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellInitiatorSituationChangedErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellSuccessPacket extends CrowniclesPacket {
	guildName!: string;

	xpEarned!: number;

	pet!: OwnedPet;

	isGuildMax!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetSellNoOneAvailableErrorPacket extends CrowniclesPacket {}
