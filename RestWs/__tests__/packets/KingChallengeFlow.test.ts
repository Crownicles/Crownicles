import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { KingChallengeTierReachedPacket } from "../../../Lib/src/packets/events/KingChallengeTierReachedPacket";
import { KingChallengeTierReachedRes } from "../../../WsPackets/src/fromServer/missions/KingChallengeTierReachedRes";
import KingChallengeServerTranslator from "../../src/packets/fromServer/translators/KingChallengeServerTranslator";

const CONTEXT: PacketContext = {
	frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}
};

function tierReached(keycloakId: string, values: Partial<KingChallengeTierReachedPacket> = {}): KingChallengeTierReachedPacket {
	return makePacket(KingChallengeTierReachedPacket, {
		keycloakId,
		tier: 3,
		crossedTiers: 2,
		reward: {
			money: 3_000, tokens: 5, gems: 1
		},
		pointsToNextTier: 1_200,
		ownedTokens: 7,
		...values
	});
}

describe("king's challenge over WebSocket", () => {
	it("pushes the tiers the player just crossed with what they paid, without the player's identity", async () => {
		const result = await KingChallengeServerTranslator.tierReached(CONTEXT, JSON.parse(JSON.stringify(tierReached("authenticated-player"))));
		expect(result).toBeInstanceOf(KingChallengeTierReachedRes);
		expect(JSON.parse(JSON.stringify(result))).toEqual({
			self: true,
			tier: 3,
			crossedTiers: 2,
			reward: {
				money: 3_000, tokens: 5, gems: 1
			},
			ownedTokens: 7
		});
	});

	it("tells a crossing paid without tokens to a player who already held the cap", async () => {
		const result = await KingChallengeServerTranslator.tierReached(CONTEXT, tierReached("authenticated-player", {
			reward: {
				money: 750, tokens: 0, gems: 0
			},
			ownedTokens: 24
		}));
		expect(result.reward.tokens).toBe(0);
		expect(result.ownedTokens).toBe(24);
	});

	it("marks the crossing of another player as not the player's own", async () => {
		const result = await KingChallengeServerTranslator.tierReached(CONTEXT, tierReached("someone-else"));
		expect(result.self).toBe(false);
	});
});
