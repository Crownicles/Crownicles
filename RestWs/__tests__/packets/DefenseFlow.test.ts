import { describe, expect, it } from "vitest";
import { makePacket, PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorDefensePersonality } from "../../../Lib/src/packets/interaction/ReactionCollectorDefensePersonality";
import {
	CommandDefenseCancelPacketRes, CommandDefenseChangeSuccessPacketRes, CommandDefenseNoChoicePacketRes
} from "../../../Lib/src/packets/commands/CommandDefensePacket";
import { AiPersonalityConstants } from "../../../Lib/src/constants/AiPersonalityConstants";
import { DefenseReq } from "../../../WsPackets/src/fromClient/DefenseReq";
import { makeFromClientPacket } from "../../../WsPackets/src/MakePackets";
import { mapCollectorCreation } from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import DefenseCommandServerTranslator from "../../src/packets/fromServer/translators/DefenseCommandServerTranslator";
import DefenseCommandClientTranslator from "../../src/packets/fromClient/translators/DefenseCommandClientTranslator";

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated", webSocket: {}};
const RECENT_DEFENSES = [{attackerClassId: 4, defenses: 5, won: 3}, {attackerClassId: 9, defenses: 1, won: 0}];

function offer(currentPersonality?: "knightFiery"): ReturnType<typeof mapCollectorCreation> {
	const collector = new ReactionCollectorDefensePersonality({
		classId: 2,
		personalities: ["knightStrategist", "knightEnduring", "knightFiery"],
		recentDefenses: RECENT_DEFENSES,
		...currentPersonality ? {currentPersonality} : {}
	}).creationPacket("defense", 1_900_000_000_000);
	return mapCollectorCreation(JSON.parse(JSON.stringify(collector)));
}

describe("defense style over WebSocket", () => {
	it("asks Core for the choice of the defense style", async () => {
		expect(JSON.parse(JSON.stringify(await DefenseCommandClientTranslator.open(CONTEXT, makeFromClientPacket(DefenseReq, {}))))).toEqual({});
	});

	it("keeps every style, the random one and the refusal at their original indexes", () => {
		expect(offer("knightFiery").reactions).toEqual([
			{type: "defenseStyle", data: {personality: "knightStrategist"}},
			{type: "defenseStyle", data: {personality: "knightEnduring"}},
			{type: "defenseStyle", data: {personality: "knightFiery"}},
			{type: "defenseStyle", data: {}},
			{type: "refuse", data: {}}
		]);
	});

	it("names the current style, the recent defenses and the window they cover", () => {
		expect(offer("knightFiery").data).toEqual({type: "defense", data: {
			classId: 2, currentPersonality: "knightFiery", recentDefenses: RECENT_DEFENSES, recentDefensesDays: AiPersonalityConstants.RECENT_DEFENSES_DAYS
		}});
	});

	it("leaves the current style out when a random one defends the player", () => {
		expect(offer().data.data).not.toHaveProperty("currentPersonality");
	});

	it("forwards the chosen style, a random one, a class without choice and a cancellation", async () => {
		expect(JSON.parse(JSON.stringify(await DefenseCommandServerTranslator.success(CONTEXT, makePacket(CommandDefenseChangeSuccessPacketRes, {personality: "mageWarlock"}))))).toEqual({personality: "mageWarlock"});
		expect(JSON.parse(JSON.stringify(await DefenseCommandServerTranslator.success(CONTEXT, makePacket(CommandDefenseChangeSuccessPacketRes, {}))))).toEqual({});
		expect(await DefenseCommandServerTranslator.noChoice(CONTEXT, makePacket(CommandDefenseNoChoicePacketRes, {classId: 5}))).toMatchObject({classId: 5});
		expect(JSON.parse(JSON.stringify(await DefenseCommandServerTranslator.cancel(CONTEXT, makePacket(CommandDefenseCancelPacketRes, {}))))).toEqual({});
	});
});
