import { FromServerPacket } from "../FromServerPacket";
import { ClassDetails } from "../../objects/ClassDetails";

export class ClassesInfoRes extends FromServerPacket {
	public static readonly wireName = "ClassesInfoRes";

	public data?: {
		classesStats: ClassDetails[];
	};
}
