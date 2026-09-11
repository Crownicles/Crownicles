import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandEquipActionRes, CommandEquipPacketReq} from "../../../Lib/src/packets/commands/CommandEquipPacket";
import {ReactionCollectorEquip} from "../../../Lib/src/packets/interaction/ReactionCollectorEquip";
import {ItemCategory, ItemConstants} from "../../../Lib/src/constants/ItemConstants";
import {EquipCategoryData} from "../../../Lib/src/types/EquipCategoryData";
import {EquipReq} from "../../../WsPackets/src/fromClient/EquipReq";
import {EquipActionReq} from "../../../WsPackets/src/fromClient/EquipActionReq";
import {EQUIP_DATA_KINDS, EQUIP_REACTION_KINDS} from "../../../WsPackets/src/fromServer/collectors";
import EquipCommandClientTranslator from "../../src/packets/fromClient/translators/EquipCommandClientTranslator";
import EquipCommandServerTranslator from "../../src/packets/fromServer/translators/EquipCommandServerTranslator";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import {InvalidClientPacketError} from "../../src/packets/fromClient/InvalidClientPacketError";

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}};

const CATEGORY: EquipCategoryData = {
	category: ItemCategory.WEAPON,
	equippedItem: null,
	reserveItems: [{slot: 3, details: {id: 7, rarity: 1, itemCategory: 0, itemLevel: 2, attack: {baseValue: 1, upgradeValue: 2, maxValue: 3}, defense: {baseValue: 1, upgradeValue: 2, maxValue: 3}, speed: {baseValue: 1, upgradeValue: 2, maxValue: 3}}}],
	maxReserveSlots: 4,
	canDeposit: true
};

describe("equipment over WebSocket", () => {
	it("opens the Core menu and preserves reserve slots and close reaction", async () => {
		expect(await EquipCommandClientTranslator.open(CONTEXT, new EquipReq())).toBeInstanceOf(CommandEquipPacketReq);
		const offered = mapCollectorCreation(new ReactionCollectorEquip([CATEGORY]).creationPacket("equip-menu", 1_900_000_000_000));
		expect(offered.data).toMatchObject({type: EQUIP_DATA_KINDS.COLLECTOR, data: {categories: [{reserveItems: [{slot: 3, details: {id: 7}}]}]}});
		expect(offered.reactions).toEqual([{type: EQUIP_REACTION_KINDS.CLOSE, data: {}}]);
	});

	it("keeps only the action and original inventory coordinates in the request", async () => {
		const request = Object.assign(new EquipActionReq(), {action: ItemConstants.EQUIP_ACTIONS.EQUIP, slot: 3, itemCategory: ItemCategory.WEAPON, keycloakId: "forged-player"});
		const translated = await EquipCommandClientTranslator.action(CONTEXT, request);
		expect(JSON.parse(JSON.stringify(translated))).toEqual({action: "equip", slot: 3, itemCategory: 0});
		expect(CONTEXT.keycloakId).toBe("authenticated-player");
	});

	it.each([{slot: -1}, {slot: 1.5}, {slot: 0}, {itemCategory: 99}, {action: "unsupported"}])("rejects invalid action coordinates %j", invalid => {
		const request = Object.assign(new EquipActionReq(), {action: ItemConstants.EQUIP_ACTIONS.EQUIP, slot: 3, itemCategory: 0}, invalid);
		expect(() => EquipCommandClientTranslator.action(CONTEXT, request)).toThrow(InvalidClientPacketError);
	});

	it("returns server refreshed categories after a successful action", async () => {
		const result = await EquipCommandServerTranslator.action(CONTEXT, makePacket(CommandEquipActionRes, {success: true, categories: [CATEGORY]}));
		expect(result.success).toBe(true);
		expect(result.categories[0].reserveItems[0].slot).toBe(3);
		expect(result).not.toHaveProperty("error");
	});

	it.each(Object.values(ItemConstants.EQUIP_ERRORS))("preserves the server rejection %s", async error => {
		const result = await EquipCommandServerTranslator.action(CONTEXT, makePacket(CommandEquipActionRes, {success: false, error, categories: []}));
		expect(result).toMatchObject({success: false, error, categories: []});
	});
});
