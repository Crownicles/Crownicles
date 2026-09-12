import { FromServerPacket } from "../FromServerPacket";
import {
	FightIntroduction, FightStatus, FightLogEntry, FightEnd, FightReward, FightError
} from "../../objects/Fight";

export class FightResumeRes extends FromServerPacket {
	public static readonly wireName = "FightResumeRes";

	active!: boolean;
}

export class FightIntroductionRes extends FromServerPacket {
	public static readonly wireName = "FightIntroductionRes";

	introduction!: FightIntroduction;
}
export class FightStatusRes extends FromServerPacket {
	public static readonly wireName = "FightStatusRes";

	status!: FightStatus;
}
export class FightLogRes extends FromServerPacket {
	public static readonly wireName = "FightLogRes";

	entry!: FightLogEntry;
}
export class FightEndRes extends FromServerPacket {
	public static readonly wireName = "FightEndRes";

	result!: FightEnd;
}
export class FightRewardRes extends FromServerPacket {
	public static readonly wireName = "FightRewardRes";

	reward!: FightReward;
}
export class FightWaitRes extends FromServerPacket {
	public static readonly wireName = "FightWaitRes";

	fightId!: string;

	ms!: number;
}
export class FightErrorRes extends FromServerPacket {
	public static readonly wireName = "FightErrorRes";

	error!: FightError;
}
