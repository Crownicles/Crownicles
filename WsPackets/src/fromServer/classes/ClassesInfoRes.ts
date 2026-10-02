import { FromServerPacket } from "../FromServerPacket";
import { ClassDetails } from "../../objects/ClassDetails";

export class ClassesInfoRes extends FromServerPacket {
	public static readonly wireName = "ClassesInfoRes";

	public data?: {
		classesStats: ClassDetails[];

		/** The player's class when it belongs to another tier than the classes offered, so it can still be compared. */
		currentClass?: ClassDetails;

		/** Absent as soon as the player may change class again. */
		nextChangeTimestamp?: number;
	};
}
