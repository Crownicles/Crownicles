import { FromServerPacket } from "../FromServerPacket";
import { AppStateFlag } from "../../objects/AppState";
import { MissionsCompletedRes } from "../missions/MissionsCompletedRes";
import { RoyalLetterRes } from "../onboarding/RoyalLetterRes";

/** Something Core credited and told the app, kept until the player has seen it. */
export type PendingReveal = {
	id: number;
	missions?: MissionsCompletedRes;
	letter?: RoyalLetterRes;
};

export class AppStateRes extends FromServerPacket {
	public static readonly wireName = "AppStateRes";

	public seen!: AppStateFlag[];

	public reveals!: PendingReveal[];
}
