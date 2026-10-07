import { FromClientPacket } from "./FromClientPacket";
import {
	EquipAction, EquipCategoryData
} from "../objects/EquipCategoryData";

export class EquipActionReq extends FromClientPacket {
	public static readonly wireName = "EquipActionReq";

	action!: EquipAction;

	itemCategory!: EquipCategoryData["category"];

	slot!: number;
}
