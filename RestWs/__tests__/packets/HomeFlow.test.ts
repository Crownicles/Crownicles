import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandReportHomeChestActionRes, CommandReportPlantTransferRes} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {HomeChestActionReq, HomeChestInfoReq, HomePlantTransferReq} from "../../../WsPackets/src/fromClient/HomeReq";
import {CHEST_ACTIONS, CHEST_ERRORS, PLANT_TRANSFER_ACTIONS} from "../../../WsPackets/src/objects/HomeChest";
import HomeClientTranslator from "../../src/packets/fromClient/translators/HomeClientTranslator";
import HomeServerTranslator from "../../src/packets/fromServer/translators/HomeServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
const CAPACITY = {weapon: 2, armor: 2, potion: 2, object: 2};

describe("home chest protocol", () => {
	it("does not forward a client-selected home or player and preserves swap slots", async () => {
		expect(await HomeClientTranslator.info(CONTEXT, Object.assign(new HomeChestInfoReq(), {keycloakId: "other", homeId: 99}))).toEqual({});
		const packet = Object.assign(new HomeChestActionReq(), {action: CHEST_ACTIONS.SWAP, slot: 2, itemCategory: 0, chestSlot: 1, keycloakId: "other", homeId: 99});
		expect(await HomeClientTranslator.chest(CONTEXT, packet)).toEqual({action: "swap", slot: 2, itemCategory: 0, chestSlot: 1});
		expect(() => HomeClientTranslator.chest(CONTEXT, {...packet, slot: 0.5})).toThrow("Invalid home slot");
		expect(() => HomeClientTranslator.chest(CONTEXT, {...packet, itemCategory: 99})).toThrow("Invalid chest category");
		expect(() => HomeClientTranslator.chest(CONTEXT, {...packet, chestSlot: -1})).toThrow("Invalid home slot");
	});

	it("returns storage and carried plants without leaking unrelated packet fields", async () => {
		const source = makePacket(CommandReportHomeChestActionRes, {
			success: true, chestItems: [], depositableItems: [], slotsPerCategory: CAPACITY, inventoryCapacity: CAPACITY,
			plantStorage: [{plantId: 1, quantity: 2, maxCapacity: 5}], playerPlantSlots: [{slot: 1, plantId: 0}], plantMaxCapacity: 5
		});
		const result = JSON.parse(JSON.stringify(await HomeServerTranslator.chest(CONTEXT, Object.assign(source, {keycloakId: "private"}))));
		expect(result.data).toEqual({chestItems: [], depositableItems: [], slotsPerCategory: CAPACITY, inventoryCapacity: CAPACITY,
			plantStorage: [{plantId: 1, quantity: 2, maxCapacity: 5}], playerPlantSlots: [{slot: 1, plantId: 0}], plantMaxCapacity: 5});
		expect(result).not.toHaveProperty("error");
		expect(result.data).not.toHaveProperty("keycloakId");
	});

	it("preserves full-inventory refusals and plant transfer outcomes", async () => {
		const refusal = await HomeServerTranslator.chest(CONTEXT, makePacket(CommandReportHomeChestActionRes, {
			success: false, error: CHEST_ERRORS.INVENTORY_FULL, chestItems: [], depositableItems: [], slotsPerCategory: CAPACITY, inventoryCapacity: CAPACITY
		}));
		expect(refusal).toMatchObject({success: false, error: "inventoryFull"});
		const result = await HomeServerTranslator.plants(CONTEXT, makePacket(CommandReportPlantTransferRes, {
			success: true, plantStorage: [{plantId: 3, quantity: 1, maxCapacity: 5}], playerPlantSlots: [{slot: 2, plantId: 3}]
		}));
		expect(result).toMatchObject({success: true, plantStorage: [{plantId: 3, quantity: 1}], playerPlantSlots: [{slot: 2, plantId: 3}]});
	});

	it("lets Core choose the deposited plant and rejects unknown withdrawal types", async () => {
		const request = Object.assign(new HomePlantTransferReq(), {action: PLANT_TRANSFER_ACTIONS.DEPOSIT, plantId: 99, playerSlot: 2});
		expect(await HomeClientTranslator.plant(CONTEXT, request)).toEqual({action: "plantDeposit", plantId: 0, playerSlot: 2});
		expect(() => HomeClientTranslator.plant(CONTEXT, {...request, action: PLANT_TRANSFER_ACTIONS.WITHDRAW})).toThrow("Invalid plant type");
	});
});