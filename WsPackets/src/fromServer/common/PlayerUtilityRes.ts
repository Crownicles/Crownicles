import { FromServerPacket } from "../FromServerPacket";
import { PlayerUtilityOutcome } from "../../objects/PlayerUtility";

export class PlayerUtilityRes extends FromServerPacket {
	public static readonly wireName = "PlayerUtilityRes";

	outcome!: PlayerUtilityOutcome;
}
export class VersionRes extends FromServerPacket {
	public static readonly wireName = "VersionRes";

	coreVersion!: string;
}
