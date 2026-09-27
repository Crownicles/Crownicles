import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandAppStateReq, CommandAppStateRes
} from "../../../Lib/src/packets/commands/CommandAppStatePacket";
import { MissionsCompletedPacket } from "../../../Lib/src/packets/events/MissionsCompletedPacket";
import { RoyalLetterPacket } from "../../../Lib/src/packets/events/RoyalLetterPacket";
import { MissionType } from "../../../Lib/src/types/CompletedMission";
import { APP_STATE_FLAGS as CORE_FLAGS } from "../../../Lib/src/types/AppState";
import { APP_STATE_FLAGS } from "../../../WsPackets/src/objects/AppState";
import { AppStateReq } from "../../../WsPackets/src/fromClient/AppStateReq";
import AppStateClientTranslator from "../../src/packets/fromClient/translators/AppStateClientTranslator";
import AppStateServerTranslator from "../../src/packets/fromServer/translators/AppStateServerTranslator";
import { InvalidClientPacketError } from "../../src/packets/fromClient/InvalidClientPacketError";

const CONTEXT: PacketContext = {
	frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}
};

function request(values: object): AppStateReq {
	return Object.assign(new AppStateReq(), values);
}

describe("app state over WebSocket", () => {
	it("names the flags Core stores, in the same order", () => {
		expect(APP_STATE_FLAGS).toEqual(CORE_FLAGS);
	});

	it("passes what the app just showed on to Core", async () => {
		const result = await AppStateClientTranslator.translate(CONTEXT, request({ seen: ["tip.tokens"], acknowledged: [3] }));
		expect(result).toBeInstanceOf(CommandAppStateReq);
		expect(result).toEqual(makePacket(CommandAppStateReq, { seen: ["tip.tokens"], acknowledged: [3] }));
	});

	it("refuses flags Core does not know and ids that are not whole", () => {
		expect(() => AppStateClientTranslator.translate(CONTEXT, request({ seen: ["everything"] }))).toThrow(InvalidClientPacketError);
		expect(() => AppStateClientTranslator.translate(CONTEXT, request({ acknowledged: [1.5] }))).toThrow(InvalidClientPacketError);
	});

	it("hands the kept rewards over as the app reads them live, without the player's identity", async () => {
		const missions = makePacket(MissionsCompletedPacket, {
			keycloakId: "private-id",
			missions: [{ missionId: "commandMission", missionType: MissionType.CAMPAIGN, missionObjective: 1, missionVariant: 0, numberDone: 1, pointsToWin: 0, xpToWin: 10, gemsToWin: 1, moneyToWin: 0, tokensToWin: 1 }]
		});
		const letter = makePacket(RoyalLetterPacket, {
			keycloakId: "private-id", letter: 1, letters: 7, tokens: 20, money: 2000, gems: 0
		});
		const packet = makePacket(CommandAppStateRes, {
			seen: ["journeyRecorded"], reveals: [{ id: 1, missions }, { id: 2, letter }]
		});
		const result = await AppStateServerTranslator.translate(CONTEXT, JSON.parse(JSON.stringify(packet)));
		expect(result.seen).toEqual(["journeyRecorded"]);
		expect(result.reveals.map(reveal => reveal.id)).toEqual([1, 2]);
		expect(result.reveals[0].missions?.missions[0].reward.tokens).toBe(1);
		expect(result.reveals[1].letter?.tokens).toBe(20);
		expect(JSON.stringify(result)).not.toContain("private-id");
	});
});
