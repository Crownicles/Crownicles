import { FromServerPacket } from "../FromServerPacket";
import { AppStateFlag } from "../../objects/AppState";
import { Badge } from "../../objects/Badge";
import { MissionsCompletedRes } from "../missions/MissionsCompletedRes";
import { RoyalLetterRes } from "../onboarding/RoyalLetterRes";
import { ItemWithDetails } from "../../objects/ItemWithDetails";
import { BossRecord } from "../../objects/Fight";

/** A moment worth sharing the app has not shown yet, with when it happened. */
export type MemorableReveal = {
	at: number;
	mythicItem?: ItemWithDetails;
	bossRecord?: BossRecord;
};

/** Something Core credited and told the app, kept until the player has seen it. */
export type PendingReveal = {
	id: number;
	missions?: MissionsCompletedRes;
	letter?: RoyalLetterRes;
	memorable?: MemorableReveal;
};

export class AppStateRes extends FromServerPacket {
	public static readonly wireName = "AppStateRes";

	public seen!: AppStateFlag[];

	public reveals!: PendingReveal[];

	/** Badges no device of the player has celebrated yet. */
	public unrevealedBadges!: Badge[];
}
