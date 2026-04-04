import { Players } from "../database/game/models/Player";
import { Guilds } from "../database/game/models/Guild";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportFoodShopBuyErrorRes,
	CommandReportFoodShopBuyReq,
	CommandReportFoodShopBuyRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { GuildShopConstants } from "../../../../Lib/src/constants/GuildShopConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { getFoodIndexOf } from "../utils/FoodUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";

export async function handleFoodShopBuy(keycloakId: string, packet: CommandReportFoodShopBuyReq): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player || !player.guildId) {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: "noGuild" });
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild || guild.shopLevel < 1) {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: "noShop" });
	}

	const foodType = packet.foodType;
	if (!PetConstants.PET_FOOD_BY_ID.includes(foodType as typeof PetConstants.PET_FOOD_BY_ID[number])) {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: "invalidFood" });
	}

	const amount = Math.max(1, Math.floor(packet.amount));
	const foodIndex = getFoodIndexOf(foodType);
	const pricePerUnit = GuildShopConstants.PRICES.FOOD[foodIndex];
	const totalCost = pricePerUnit * amount;

	if (player.money < totalCost) {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: "notEnoughMoney" });
	}

	if (guild.isStorageFullFor(foodType, amount)) {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: "storageFull" });
	}

	// Compute max affordable and storable amount
	const foodCap = GuildDomainConstants.getFoodCaps(guild.pantryLevel)[foodIndex];
	const currentStock = guild.getDataValue(foodType) as number;
	const maxStorable = foodCap - currentStock;
	const maxAffordable = Math.floor(player.money / pricePerUnit);
	const actualAmount = Math.min(amount, maxStorable, maxAffordable);

	if (actualAmount <= 0) {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: "cannotBuy" });
	}

	const actualCost = pricePerUnit * actualAmount;
	await player.spendMoney({
		amount: actualCost, response: [], reason: NumberChangeReason.SHOP
	});
	guild.addFood(foodType, actualAmount, NumberChangeReason.SHOP);
	await guild.save();
	await player.save();

	return makePacket(CommandReportFoodShopBuyRes, {
		foodType,
		newFoodStock: guild.getDataValue(foodType) as number,
		newPlayerMoney: player.money,
		amountBought: actualAmount
	});
}
