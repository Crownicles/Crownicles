import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { KingChallengeReward } from "../../types/KingChallenge";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class KingChallengeTierReachedPacket extends CrowniclesPacket {
	keycloakId!: string;

	/** Number of tiers reached this week after the crossing */
	tier!: number;

	/** Number of tiers crossed at once */
	crossedTiers!: number;

	/** Rewards actually granted for the crossed tiers */
	reward!: KingChallengeReward;

	/** Points still needed to reach the next tier, absent once the last tier is reached */
	pointsToNextTier?: number;

	/** Tokens owned by the player after the reward */
	ownedTokens!: number;
}
