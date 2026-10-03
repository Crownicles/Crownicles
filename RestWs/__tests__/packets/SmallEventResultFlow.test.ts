import {describe, expect, it, vi} from "vitest";
import {SmallEventResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";
import {translateSmallEventResult} from "../../src/packets/fromServer/translators/SmallEventResultServerTranslator";
import {SmallEventBigBadKind} from "../../../Lib/src/types/SmallEventBigBadKind";
import {InteractOtherPlayerInteraction} from "../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";

vi.mock("../../src/packets/fromServer/PlayerDisplay", () => ({resolvePlayerName: vi.fn(async () => "Aventurier")}));

describe("generic small-event result over the WebSocket protocol", () => {
	it("keeps every field the Discord story is written from", async () => {
		const result = await translateSmallEventResult("SmallEventFindMissionPacket", {
			materialRarity: 2, materialType: "wood", mission: {missionId: "x", missionObjective: 4}, items: [1, 2]
		});

		expect(result).toBeInstanceOf(SmallEventResultRes);
		expect(result).toEqual({
			eventName: "SmallEventFindMissionPacket",
			data: {materialRarity: 2, materialType: "wood", mission: {missionId: "x", missionObjective: 4}, items: [1, 2]}
		});
	});

	it("replaces internal player identifiers with the names they stand for", async () => {
		const result = await translateSmallEventResult("SmallEventPetDropTokenPacket", {
			ownerKeycloakId: "internal-player-id",
			petTypeId: 12
		});

		expect(result.data).toEqual({petTypeId: 12, ownerName: "Aventurier"});
		expect(JSON.stringify(result)).not.toContain("internal-player-id");
	});

	it("sends numeric enums by member name", async () => {
		const bigBad = await translateSmallEventResult("SmallEventBigBadPacket", {kind: SmallEventBigBadKind.MONEY_LOSS, moneyLost: 40});
		const interaction = await translateSmallEventResult("SmallEventInteractOtherPlayersPacket", {
			keycloakId: "other-player",
			playerInteraction: InteractOtherPlayerInteraction.TOP10,
			data: {rank: 7, level: 30}
		});

		expect(bigBad.data).toEqual({kind: "MONEY_LOSS", moneyLost: 40});
		expect(interaction.data).toEqual({playerInteraction: "TOP10", playerName: "Aventurier", data: {rank: 7, level: 30}});
	});
});
