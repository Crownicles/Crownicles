import { FromServerPacket } from "../FromServerPacket";

export class ClassesRes extends FromServerPacket {
	public static readonly wireName = "ClassesRes";

	public classId!: number;
}

export class ClassesCooldownRes extends FromServerPacket {
	public static readonly wireName = "ClassesCooldownRes";

	public timestamp!: number;
}

export class ClassesCancelRes extends FromServerPacket {
	public static readonly wireName = "ClassesCancelRes";
}
