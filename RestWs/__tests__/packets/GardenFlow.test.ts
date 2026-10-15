import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandGardenNoAccessRes, GardenNoAccessReason} from "../../../Lib/src/packets/commands/CommandGardenPacket";
import {CommandReportGardenWaterRes, CommandReportGardenCompostRes} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {GardenInfoReq, GardenActionReq} from "../../../WsPackets/src/fromClient/GardenReq";
import GardenClientTranslator from "../../src/packets/fromClient/translators/GardenClientTranslator";
import GardenServerTranslator from "../../src/packets/fromServer/translators/GardenServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
describe("garden protocol", () => {
	it("uses the authenticated player and preserves the selected garden slot", async () => {
		expect(await GardenClientTranslator.info(CONTEXT, Object.assign(new GardenInfoReq(), {homeId: 99}))).toEqual({});
		expect(await GardenClientTranslator.action(CONTEXT, Object.assign(new GardenActionReq(), {operation: {type: "plant", gardenSlot: 4, playerId: 99}}))).toEqual({operation: {type: "plant", gardenSlot: 4}});
	});
	it("rejects fractional slots, invalid plants and unoffered compost quantities", () => {
		expect(() => GardenClientTranslator.action(CONTEXT, {operation: {type: "plant", gardenSlot: 1.5}})).toThrow("Invalid garden slot");
		expect(() => GardenClientTranslator.action(CONTEXT, Object.assign(new GardenActionReq(), {operation: {type: "compost", plantId: 99, quantity: 1}}))).toThrow("Invalid compost plant");
		expect(() => GardenClientTranslator.action(CONTEXT, {operation: {type: "compost", plantId: 1, quantity: 9}})).toThrow("Invalid compost quantity");
	});
	it("transports access refusals and the actual watering time", async () => {
		expect(await GardenServerTranslator.noAccess(CONTEXT, makePacket(CommandGardenNoAccessRes, {reason: GardenNoAccessReason.NO_TALISMAN}))).toMatchObject({outcome: {kind: "noAccess", reason: "noTalisman"}});
		expect(await GardenServerTranslator.water(CONTEXT, makePacket(CommandReportGardenWaterRes, {slotsWatered: 2, slotsBecameReady: 1, nextWateringAvailableAt: 123456}))).toMatchObject({outcome: {kind: "water", slotsWatered: 2, slotsBecameReady: 1, nextWateringAvailableAt: 123456}});
	});
	it("preserves repeated material gains after composting", async () => {
		expect(await GardenServerTranslator.compost(CONTEXT, makePacket(CommandReportGardenCompostRes, {plantId: 2, quantity: 5, materials: [7, 7, 9, 7, 9]}))).toMatchObject({outcome: {kind: "compost", quantity: 5, materials: [7, 7, 9, 7, 9]}});
	});
});