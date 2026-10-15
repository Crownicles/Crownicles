import {describe, expect, it} from "vitest";
import {PacketContext, makePacket} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandReportGuildDomainDepositTreasuryRes, CommandReportGuildDomainUpgradeRes, CommandReportFoodShopBuyRes} from "../../../Lib/src/packets/commands/CommandReportPacket";
import {GuildBuilding as CoreBuilding} from "../../../Lib/src/constants/GuildDomainConstants";
import {PetConstants} from "../../../Lib/src/constants/PetConstants";
import {GuildDomainDepositReq, GuildDomainFoodReq} from "../../../WsPackets/src/fromClient/GuildDomainReq";
import {PetFood} from "../../../WsPackets/src/objects/PetFood";
import GuildDomainClientTranslator from "../../src/packets/fromClient/translators/GuildDomainClientTranslator";
import GuildDomainServerTranslator from "../../src/packets/fromServer/translators/GuildDomainServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

describe("guild domain contracts", () => {
	it("does not allow a client to waive the deposit commission or select an identity", async () => {
		const request = Object.assign(new GuildDomainDepositReq(), {amount: 1000, isReimburse: true, keycloakId: "other"});
		const packet = await GuildDomainClientTranslator.deposit(CONTEXT, request);
		expect(JSON.parse(JSON.stringify(packet))).toEqual({amount: 1000});
	});
	it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid purchase amount %s", amount => {
		expect(() => GuildDomainClientTranslator.food(CONTEXT, Object.assign(new GuildDomainFoodReq(), {amount, foodType: PetFood.CANDY}))).toThrow("Invalid guild domain amount");
	});
	it("forwards the exact charged amount, credited treasury and actual food purchase", async () => {
		const deposit = await GuildDomainServerTranslator.deposit(CONTEXT, makePacket(CommandReportGuildDomainDepositTreasuryRes, {treasuryDeposited: 950, newPlayerMoney: 100, newTreasury: 1050}));
		expect(deposit.outcome).toEqual({type: "deposit", treasuryDeposited: 950, newPlayerMoney: 100, newTreasury: 1050});
		const upgrade = await GuildDomainServerTranslator.upgrade(CONTEXT, makePacket(CommandReportGuildDomainUpgradeRes, {building: CoreBuilding.SHOP, newLevel: 1, cost: 2000, newTreasury: 3000, xpGained: 400}));
		expect(upgrade.outcome).toMatchObject({type: "upgrade", cost: 2000, xpGained: 400});
		const food = await GuildDomainServerTranslator.food(CONTEXT, makePacket(CommandReportFoodShopBuyRes, {foodType: PetConstants.PET_FOOD.COMMON_FOOD, amountBought: 2, totalCost: 40, newTreasury: 2960, newFoodStock: 2}));
		expect(food.outcome).toMatchObject({type: "food", amountBought: 2, totalCost: 40});
	});
});
