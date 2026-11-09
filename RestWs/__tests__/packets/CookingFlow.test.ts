import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandReportCookingCraftRes, CommandReportCookingWoodConfirmReq, CommandReportCookingMenuRes, CommandReportCookingNoWoodRes, CommandReportCookingUnavailableRes, CommandReportCookingSetSpecialtyRes, CommandReportCookingRemoveSpecialtyRes} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {CookingMenuSnapshot, CookingSpecialtyErrors} from "../../../Lib/src/types/CookingTypes";
import {CookingSpecialtyConstants, SPECIALTY_SLOT_INDEX, TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD} from "../../../Lib/src/constants/CookingConstants";
import {CookingCraftReq, CookingRemoveSpecialtyReq, CookingSetSpecialtyReq, CookingWoodConfirmReq} from "../../../WsPackets/src/fromClient/CookingReq";
import {CookingCraftErrors, CookingOutputType, RecipeType} from "../../../WsPackets/src/objects/Cooking";
import {CookingRes} from "../../../WsPackets/src/fromServer/home/CookingRes";
import CookingClientTranslator from "../../src/packets/fromClient/translators/CookingClientTranslator";
import CookingServerTranslator from "../../src/packets/fromServer/translators/CookingServerTranslator";
import {getServerTranslator} from "../../src/packets/fromServer/FromServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};
const MENU: CookingMenuSnapshot = {cookingLevel: 7, cookingGrade: "kitchenHelper", isIgnited: true, currentSlots: [{slotIndex: 2, recipe: {id: "potion_health_1", level: 1, isSecret: false, outputDescription: "", outputType: CookingOutputType.POTION, recipeType: RecipeType.POTION_HEALTH, ingredients: {plants: [{plantId: 1, quantity: 2, playerHas: 4}], materials: []}, canCraft: true}}]};

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
	it("tells the app the master chef badge was earned with the dish that earned it", async () => {
		const answer = await CookingServerTranslator.craft(CONTEXT, makePacket(CommandReportCookingCraftRes, {success: true, recipeId: "potion_health_1", wasSecret: false, outputType: CookingOutputType.POTION, potionId: 3, cookingXpGained: 40, cookingLevelUp: true, newCookingLevel: 100, masterChefBadgeEarned: true, menu: MENU}));
		expect(answer.outcome).toMatchObject({kind: "crafted", result: {masterChefBadgeEarned: true, newCookingLevel: 100}});
	});
	it("registers and transports explicit unavailable and no-wood outcomes", async () => {
		const unavailable = getServerTranslator(CommandReportCookingUnavailableRes.name)!;
		expect(unavailable.protoName).toBe(CookingRes.wireName);
		expect(await unavailable.translatorFunc(CONTEXT, makePacket(CommandReportCookingUnavailableRes, {}))).toMatchObject({outcome: {kind: "unavailable"}});
		expect(await CookingServerTranslator.noWood(CONTEXT, makePacket(CommandReportCookingNoWoodRes, {}))).toMatchObject({outcome: {kind: "noWood"}});
		expect(await CookingServerTranslator.menu(CONTEXT, makePacket(CommandReportCookingMenuRes, {menu: MENU}))).toMatchObject({outcome: {kind: "menu", menu: MENU}});
	});
	it("forwards a specialty choice with the station that offered it, and a removal with the view it came from", async () => {
		const choice = Object.assign(new CookingSetSpecialtyReq(), {slotIndex: 1, recipeId: "potion_time_2", keycloakId: "other"});
		expect(await CookingClientTranslator.setSpecialty(CONTEXT, choice)).toEqual({slotIndex: 1, recipeId: "potion_time_2"});
		expect(() => CookingClientTranslator.setSpecialty(CONTEXT, {...choice, slotIndex: -1})).toThrow("Invalid cooking slot");
		expect(() => CookingClientTranslator.setSpecialty(CONTEXT, {...choice, recipeId: ""})).toThrow("Invalid cooking recipe");
		const removal = Object.assign(new CookingRemoveSpecialtyReq(), {recipeId: "potion_time_2", fromIgnitedView: false});
		expect(await CookingClientTranslator.removeSpecialty(CONTEXT, removal)).toEqual({recipeId: "potion_time_2", fromIgnitedView: false});
		expect(() => CookingClientTranslator.removeSpecialty(CONTEXT, {...removal, fromIgnitedView: "no" as unknown as boolean})).toThrow("Invalid cooking confirmation");
	});
	it("tells the app the specialties the cook's level allows and the level unlocking the next one", async () => {
		const [firstUnlock, secondUnlock] = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS;
		const apprentice = await CookingServerTranslator.menu(CONTEXT, makePacket(CommandReportCookingMenuRes, {menu: MENU}));
		const chef = await CookingServerTranslator.menu(CONTEXT, makePacket(CommandReportCookingMenuRes, {menu: {...MENU, cookingLevel: firstUnlock}}));
		const master = await CookingServerTranslator.menu(CONTEXT, makePacket(CommandReportCookingMenuRes, {menu: {...MENU, cookingLevel: CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS.at(-1)!}}));
		expect(apprentice.outcome).toMatchObject({menu: {rules: {specialtyStation: SPECIALTY_SLOT_INDEX, specialtyLimit: 0, nextSpecialtyLevel: firstUnlock, timePotionsShownFrom: TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD}}});
		expect(chef.outcome).toMatchObject({menu: {rules: {specialtyLimit: 1, nextSpecialtyLevel: secondUnlock}}});
		expect(master.outcome).toMatchObject({menu: {rules: {specialtyLimit: CookingSpecialtyConstants.MAX_SPECIALTIES}}});
		expect(master.outcome).not.toHaveProperty("menu.rules.nextSpecialtyLevel");
	});
	it("carries the specialties, the time potions left and the rules on the menu of a cooked dish", async () => {
		const menu: CookingMenuSnapshot = {
			...MENU,
			specialties: [{recipeId: "potion_time_2", level: 4, recipeType: RecipeType.POTION_TIME_SPEEDUP, canCraft: false}],
			currentSlots: [{slotIndex: SPECIALTY_SLOT_INDEX, recipe: {...MENU.currentSlots[0].recipe!, id: "potion_time_2", recipeType: RecipeType.POTION_TIME_SPEEDUP, canCraft: false, timePotionsLeftThisWeek: 0}}]
		};
		const answer = await CookingServerTranslator.craft(CONTEXT, makePacket(CommandReportCookingCraftRes, {success: false, recipeId: "potion_time_2", wasSecret: false, outputType: CookingOutputType.POTION, error: CookingCraftErrors.TIME_POTION_WEEKLY_LIMIT, cookingXpGained: 0, cookingLevelUp: false, menu}));
		expect(answer.outcome).toMatchObject({kind: "crafted", result: {error: "timePotionWeeklyLimit", menu: {
			specialties: [{recipeId: "potion_time_2", canCraft: false}],
			currentSlots: [{slotIndex: SPECIALTY_SLOT_INDEX, recipe: {timePotionsLeftThisWeek: 0}}],
			rules: {specialtyStation: SPECIALTY_SLOT_INDEX}
		}}});
	});
	it("registers both specialty answers, with the reason a choice was refused", async () => {
		const chosen = getServerTranslator(CommandReportCookingSetSpecialtyRes.name)!;
		const removed = getServerTranslator(CommandReportCookingRemoveSpecialtyRes.name)!;
		expect(chosen.protoName).toBe(CookingRes.wireName);
		expect(removed.protoName).toBe(CookingRes.wireName);
		expect(await chosen.translatorFunc(CONTEXT, makePacket(CommandReportCookingSetSpecialtyRes, {error: CookingSpecialtyErrors.LIMIT_REACHED, menu: MENU}))).toMatchObject({outcome: {kind: "specialtyChosen", error: "specialtyLimitReached", menu: {currentSlots: MENU.currentSlots}}});
		expect((await chosen.translatorFunc(CONTEXT, makePacket(CommandReportCookingSetSpecialtyRes, {menu: MENU})) as CookingRes).outcome).not.toHaveProperty("error");
		expect(await removed.translatorFunc(CONTEXT, makePacket(CommandReportCookingRemoveSpecialtyRes, {menu: MENU}))).toMatchObject({outcome: {kind: "specialtyRemoved", menu: {currentSlots: MENU.currentSlots}}});
	});
});