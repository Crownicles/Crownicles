import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { PlayerLevelUpPacket } from "../../../Lib/src/packets/events/PlayerLevelUpPacket";
import PlayerLevelUpServerTranslator from "../../src/packets/fromServer/translators/PlayerLevelUpServerTranslator";

const CONTEXT: PacketContext = {
	frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}
};

function levelUp(keycloakId: string): PlayerLevelUpPacket {
	return makePacket(PlayerLevelUpPacket, {
		keycloakId,
		level: 5,
		fightUnlocked: false,
		guildUnlocked: false,
		healthRestored: true,
		classesTier1Unlocked: false,
		classesTier2Unlocked: false,
		classesTier3Unlocked: false,
		classesTier4Unlocked: false,
		classesTier5Unlocked: false,
		missionSlotUnlocked: false,
		pveUnlocked: false,
		statsIncreased: true
	});
}

describe("level up over WebSocket", () => {
	it("tells the app its own character levelled up, with what the level brings", async () => {
		const result = await PlayerLevelUpServerTranslator.translate(CONTEXT, levelUp("authenticated-player"));
		expect(result).toMatchObject({
			self: true, level: 5, healthRestored: true, statsIncreased: true, missionSlotUnlocked: false
		});
	});

	it("marks the level up of another guild member as not the player's own", async () => {
		const result = await PlayerLevelUpServerTranslator.translate(CONTEXT, levelUp("guild-member"));
		expect(result.self).toBe(false);
	});
});
