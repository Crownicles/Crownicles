import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandReportCookingCraftRes, CommandReportCookingWoodConfirmReq, CommandReportCookingMenuRes, CommandReportCookingNoWoodRes, CommandReportCookingUnavailableRes} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {CookingCraftReq, CookingWoodConfirmReq} from "../../../WsPackets/src/fromClient/CookingReq";
import {CookingCraftErrors, CookingMenu, CookingOutputType, RecipeType} from "../../../WsPackets/src/objects/Cooking";
import {CookingRes} from "../../../WsPackets/src/fromServer/home/CookingRes";
import CookingClientTranslator from "../../src/packets/fromClient/translators/CookingClientTranslator";
import CookingServerTranslator from "../../src/packets/fromServer/translators/CookingServerTranslator";
import {getServerTranslator} from "../../src/packets/fromServer/FromServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
const MENU: CookingMenu = {cookingLevel: 7, cookingGrade: "kitchenHelper", isIgnited: true, currentSlots: [{slotIndex: 2, recipe: {id: "potion_health_1", level: 1, isSecret: false, outputDescription: "", outputType: CookingOutputType.POTION, recipeType: RecipeType.POTION_HEALTH, ingredients: {plants: [{plantId: 1, quantity: 2, playerHas: 4}], materials: []}, canCraft: true}}]};

describe("cooking protocol", () => {
	it("forwards the clicked recipe and slot, never a client-selected owner", async () => {
		const request = Object.assign(new CookingCraftReq(), {recipeId: "potion_health_1", slotIndex: 2, keycloakId: "other"});
		expect(await CookingClientTranslator.craft(CONTEXT, request)).toEqual({recipeId: "potion_health_1", slotIndex: 2});
		expect(() => CookingClientTranslator.craft(CONTEXT, {...request, slotIndex: 0.2})).toThrow("Invalid cooking slot");
		expect(() => CookingClientTranslator.craft(CONTEXT, {...request, recipeId: " "})).toThrow("Invalid cooking recipe");
	});
	it("keeps rare wood selection on Core and forwards only consent", async () => {
		const request = Object.assign(new CookingWoodConfirmReq(), {accepted: false, woodMaterialId: 999});
		expect(await CookingClientTranslator.wood(CONTEXT, request)).toEqual({accepted: false});
		const answer = await CookingServerTranslator.wood(CONTEXT, makePacket(CommandReportCookingWoodConfirmReq, {woodMaterialId: 9, woodRarity: 3}));
		expect(answer.outcome).toEqual({kind: "woodConfirmation", woodMaterialId: 9, woodRarity: 3});
	});
	it("retains a refreshed snapshot when a stale recipe is rejected", async () => {
		const answer = await CookingServerTranslator.craft(CONTEXT, makePacket(CommandReportCookingCraftRes, {success: false, recipeId: "potion_health_1", wasSecret: false, outputType: CookingOutputType.POTION, error: CookingCraftErrors.CRAFT_UNAVAILABLE, cookingXpGained: 0, cookingLevelUp: false, menu: MENU}));
		expect(answer.outcome).toMatchObject({kind: "crafted", result: {error: "craftUnavailable", menu: {currentSlots: [{slotIndex: 2, recipe: {id: "potion_health_1", canCraft: true}}]}}});
	});
	it("registers and transports explicit unavailable and no-wood outcomes", async () => {
		const unavailable = getServerTranslator(CommandReportCookingUnavailableRes.name)!;
		expect(unavailable.protoName).toBe(CookingRes.wireName);
		expect(await unavailable.translatorFunc(CONTEXT, makePacket(CommandReportCookingUnavailableRes, {}))).toMatchObject({outcome: {kind: "unavailable"}});
		expect(await CookingServerTranslator.noWood(CONTEXT, makePacket(CommandReportCookingNoWoodRes, {}))).toMatchObject({outcome: {kind: "noWood"}});
		expect(await CookingServerTranslator.menu(CONTEXT, makePacket(CommandReportCookingMenuRes, {menu: MENU}))).toMatchObject({outcome: {kind: "menu", menu: MENU}});
	});
});