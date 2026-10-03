import { FromClientPacket } from "./FromClientPacket";

export class CookingMenuReq extends FromClientPacket {
	public static readonly wireName = "CookingMenuReq";
}
export class CookingIgniteReq extends FromClientPacket {
	public static readonly wireName = "CookingIgniteReq";
}
export class CookingReviveReq extends FromClientPacket {
	public static readonly wireName = "CookingReviveReq";
}
export class CookingWoodConfirmReq extends FromClientPacket {
	public static readonly wireName = "CookingWoodConfirmReq";

	accepted!: boolean;
}
export class CookingCraftReq extends FromClientPacket {
	public static readonly wireName = "CookingCraftReq";

	slotIndex!: number;

	recipeId!: string;
}
export class CookingPinReq extends FromClientPacket {
	public static readonly wireName = "CookingPinReq";

	recipeId!: string;

	fromIgnitedView!: boolean;
}
export class CookingUnpinReq extends FromClientPacket {
	public static readonly wireName = "CookingUnpinReq";

	fromIgnitedView!: boolean;
}
