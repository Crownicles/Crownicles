import {
	describe, expect, it
} from "vitest";
import { PetConstants } from "../../../Lib/src/constants/PetConstants";
import { ReportCityMenuIds } from "../../src/commands/player/report/ReportCityMenuConstants";
import { parseFoodShopBuyCustomId } from "../../src/commands/player/report/guildDomain/GuildDomainShared";

describe("parseFoodShopBuyCustomId", () => {
	it("extracts the food type and quantity from a valid buy button id", () => {
		const customId = `${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX}${PetConstants.PET_FOOD.COMMON_FOOD}_25`;

		expect(parseFoodShopBuyCustomId(customId)).toEqual({
			foodType: PetConstants.PET_FOOD.COMMON_FOOD,
			amount: 25
		});
	});

	it("rejects malformed quantities instead of dispatching a buy", () => {
		expect(parseFoodShopBuyCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX}${PetConstants.PET_FOOD.COMMON_FOOD}_0`)).toBeNull();
		expect(parseFoodShopBuyCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX}${PetConstants.PET_FOOD.COMMON_FOOD}_NaN`)).toBeNull();
		expect(parseFoodShopBuyCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX}${PetConstants.PET_FOOD.COMMON_FOOD}_5abc`)).toBeNull();
		expect(parseFoodShopBuyCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX}${PetConstants.PET_FOOD.COMMON_FOOD}`)).toBeNull();
	});

	it("rejects unknown food types", () => {
		expect(parseFoodShopBuyCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_FOOD_PREFIX}unknownFood_5`)).toBeNull();
	});

	it("ignores custom ids from other menus", () => {
		expect(parseFoodShopBuyCustomId(`${ReportCityMenuIds.GUILD_DOMAIN_SHOP_DEPOSIT_PREFIX}500`)).toBeNull();
	});
});
