import { FromServerPacket } from "../FromServerPacket";
import {
	EquipCategoryData, EquipError
} from "../../objects/EquipCategoryData";

export class EquipActionRes extends FromServerPacket {
	public static readonly wireName = "EquipActionRes";

	success!: boolean;

	error?: EquipError;

	categories!: EquipCategoryData[];
}
