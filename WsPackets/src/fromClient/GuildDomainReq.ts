import { FromClientPacket } from "./FromClientPacket";
import { GuildBuilding } from "../objects/GuildDomain";
import { PetFood } from "../objects/PetFood";

export class GuildDomainInfoReq extends FromClientPacket {
	public static readonly wireName = "GuildDomainInfoReq";
}

export class GuildDomainUpgradeReq extends FromClientPacket {
	public static readonly wireName = "GuildDomainUpgradeReq";

	building!: GuildBuilding;

	expectedLevel!: number;
}
export class GuildDomainFoodReq extends FromClientPacket {
	public static readonly wireName = "GuildDomainFoodReq";

	foodType!: PetFood;

	amount!: number;
}
export class GuildDomainDepositReq extends FromClientPacket {
	public static readonly wireName = "GuildDomainDepositReq";

	amount!: number;
}
