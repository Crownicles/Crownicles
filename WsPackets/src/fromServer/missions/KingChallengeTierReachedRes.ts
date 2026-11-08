import { FromServerPacket } from "../FromServerPacket";
import { KingChallengeReward } from "../../objects/KingChallenge";

/** Pushed when a score gain crosses tiers of the king's challenge; their rewards are already credited. */
export class KingChallengeTierReachedRes extends FromServerPacket {
	public static readonly wireName = "KingChallengeTierReachedRes";

	/** Whether the character who crossed the tiers is the one this app plays. */
	public self!: boolean;

	/** Number of tiers reached this week after the crossing. */
	public tier!: number;

	/** Number of tiers crossed at once. */
	public crossedTiers!: number;

	/** What the crossed tiers actually paid: no token when the player already held the token cap. */
	public reward!: KingChallengeReward;

	/** Tokens the player owns once paid. */
	public ownedTokens!: number;
}
