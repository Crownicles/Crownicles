import Player, { Players } from "../database/game/models/Player";
import Guild, { Guilds } from "../database/game/models/Guild";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportFoodShopBuyErrorRes,
	CommandReportFoodShopBuyReq,
	CommandReportFoodShopBuyRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	PetConstants, PetFood
} from "../../../../Lib/src/constants/PetConstants";
import { getFoodIndexOf } from "../utils/FoodUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	GUILD_DOMAIN_ERROR, GuildDomainConstants, GuildDomainError
} from "../../../../Lib/src/constants/GuildDomainConstants";

interface ResolvedFoodShop {
	player: Player;
	guild: Guild;
	foodType: PetFood;
	amount: number;
	foodIndex: number;
	pricePerUnit: number;
}

async function resolveFoodShopRequest(
	keycloakId: string, packet: CommandReportFoodShopBuyReq
): Promise<ResolvedFoodShop | GuildDomainError> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player || !player.guildId) {
		return GUILD_DOMAIN_ERROR.NO_GUILD;
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild || guild.shopLevel < 1) {
		return GUILD_DOMAIN_ERROR.NO_SHOP;
	}

	const foodType = packet.foodType;
	if (!PetConstants.PET_FOOD_BY_ID.includes(foodType)) {
		return GUILD_DOMAIN_ERROR.INVALID_FOOD;
	}

	const amount = Math.max(1, Math.floor(packet.amount));
	const foodIndex = getFoodIndexOf(foodType);
	const pricePerUnit = GuildDomainConstants.SHOP_PRICES.FOOD[foodIndex];

	if (player.money < pricePerUnit * amount) {
		return GUILD_DOMAIN_ERROR.NOT_ENOUGH_MONEY;
	}

	if (guild.isStorageFullFor(foodType, amount)) {
		return GUILD_DOMAIN_ERROR.STORAGE_FULL;
	}

	return {
		player, guild, foodType, amount, foodIndex, pricePerUnit
	};
}

function computeAffordableAmount(req: ResolvedFoodShop): number {
	const maxStorable = req.guild.getFoodCapacityFor(req.foodType) - req.guild.getFoodAmount(req.foodType);
	const maxAffordable = Math.floor(req.player.money / req.pricePerUnit);
	return Math.min(req.amount, maxStorable, maxAffordable);
}

export async function handleFoodShopBuy(keycloakId: string, packet: CommandReportFoodShopBuyReq): Promise<CrowniclesPacket> {
	const resolved = await resolveFoodShopRequest(keycloakId, packet);
	if (typeof resolved === "string") {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: resolved });
	}

	const actualAmount = computeAffordableAmount(resolved);
	if (actualAmount <= 0) {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: GUILD_DOMAIN_ERROR.CANNOT_BUY });
	}

	const {
		player, guild, foodType, pricePerUnit
	} = resolved;
	await player.spendMoney({
		amount: pricePerUnit * actualAmount, response: [], reason: NumberChangeReason.SHOP
	});
	guild.addFood(foodType, actualAmount, NumberChangeReason.SHOP);
	await guild.save();
	await player.save();

	return makePacket(CommandReportFoodShopBuyRes, {
		foodType,
		newFoodStock: guild.getFoodAmount(foodType),
		newPlayerMoney: player.money,
		amountBought: actualAmount
	});
}
