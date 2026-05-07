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
	guildId: number;
	foodType: PetFood;
	amount: number;
	foodIndex: number;
	pricePerUnit: number;
}

/**
 * Resolve the (player, guild) pair from the request author and verify
 * the guild has a working shop. Pulled out of {@link resolveFoodShopRequest}
 * to keep the latter's cyclomatic complexity low (CodeScene
 * "Complex Method" advisory).
 */
async function resolveBuyerAndShop(
	keycloakId: string
): Promise<{
	player: Player; guild: Guild;
} | GuildDomainError> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player?.guildId) {
		return GUILD_DOMAIN_ERROR.NO_GUILD;
	}

	const guild = await Guilds.getById(player.guildId);
	if (!guild || guild.shopLevel < 1) {
		return GUILD_DOMAIN_ERROR.NO_SHOP;
	}

	return {
		player, guild
	};
}

/**
 * Validate the requested food line against the (already-loaded) guild,
 * applying the cheap fast-fail checks. Authoritative affordability +
 * capacity is re-checked under the row lock — see
 * {@link handleFoodShopBuy}.
 */
function buildFoodShopRequest(
	player: Player,
	guild: Guild,
	packet: CommandReportFoodShopBuyReq
): ResolvedFoodShop | GuildDomainError {
	const foodType = packet.foodType;
	if (!PetConstants.PET_FOOD_BY_ID.includes(foodType)) {
		return GUILD_DOMAIN_ERROR.INVALID_FOOD;
	}

	const amount = Math.max(1, Math.floor(packet.amount));
	const foodIndex = getFoodIndexOf(foodType);
	const pricePerUnit = GuildDomainConstants.SHOP_PRICES.FOOD[foodIndex];

	// Hint-only treasury check: re-validated under the lock below.
	if (guild.treasury < pricePerUnit * amount && guild.treasury < pricePerUnit) {
		return GUILD_DOMAIN_ERROR.NOT_ENOUGH_TREASURY;
	}

	if (guild.isStorageFullFor(foodType, 1)) {
		return GUILD_DOMAIN_ERROR.STORAGE_FULL;
	}

	return {
		player, guildId: player.guildId!, foodType, amount, foodIndex, pricePerUnit
	};
}

/**
 * First-pass resolution: cheap precondition checks that *don't* mutate
 * state, run outside the lock.
 *
 * The values read from `guild` here (`shopLevel`, `treasury`,
 * `getFoodAmount`) are intentionally treated as **hints**: they only
 * gate fast-failure errors (no-shop, invalid-food). The authoritative
 * affordability + capacity check is re-done inside
 * {@link handleFoodShopBuy}'s `Guild.withLocked` block, against the
 * row-locked guild instance, so two concurrent buyers cannot both pass
 * a stale check (the bug PR-C fixes).
 */
async function resolveFoodShopRequest(
	keycloakId: string, packet: CommandReportFoodShopBuyReq
): Promise<ResolvedFoodShop | GuildDomainError> {
	const buyerAndShop = await resolveBuyerAndShop(keycloakId);
	if (typeof buyerAndShop === "string") {
		return buyerAndShop;
	}
	return buildFoodShopRequest(buyerAndShop.player, buyerAndShop.guild, packet);
}

/**
 * Maximum amount the buyer can actually take given the *currently
 * locked* `guild` row. Computed inside the critical section so the
 * inputs are never stale.
 */
function computeAffordableAmount(guild: Guild, request: ResolvedFoodShop): number {
	const maxStorable = guild.getFoodCapacityFor(request.foodType) - guild.getFoodAmount(request.foodType);
	const maxAffordable = Math.floor(guild.treasury / request.pricePerUnit);
	return Math.min(request.amount, maxStorable, maxAffordable);
}

export async function handleFoodShopBuy(keycloakId: string, packet: CommandReportFoodShopBuyReq): Promise<CrowniclesPacket> {
	const resolved = await resolveFoodShopRequest(keycloakId, packet);
	if (typeof resolved === "string") {
		return makePacket(CommandReportFoodShopBuyErrorRes, { error: resolved });
	}

	/*
	 * Critical section: lock the guild row with `SELECT … FOR UPDATE`,
	 * recompute affordability from the freshly-locked state (any value
	 * read in `resolveFoodShopRequest` could be stale by now), then
	 * mutate + save inside the same transaction.
	 *
	 * Concurrent food-shop buyers on the same guild now serialise on
	 * this row instead of both passing a stale treasury check and
	 * over-spending it (the PR-C bug — see
	 * `Core/__tests__-integration/handlers/handleFoodShopBuy.race.test.ts`).
	 */
	return await Guild.withLocked(resolved.guildId, async guild => {
		const actualAmount = computeAffordableAmount(guild, resolved);
		if (actualAmount <= 0) {
			return makePacket(CommandReportFoodShopBuyErrorRes, { error: GUILD_DOMAIN_ERROR.CANNOT_BUY });
		}

		const totalCost = resolved.pricePerUnit * actualAmount;
		guild.treasury -= totalCost;
		guild.addFood(resolved.foodType, actualAmount, NumberChangeReason.SHOP);
		await guild.save();

		return makePacket(CommandReportFoodShopBuyRes, {
			foodType: resolved.foodType,
			newFoodStock: guild.getFoodAmount(resolved.foodType),
			newTreasury: guild.treasury,
			amountBought: actualAmount,
			totalCost
		});
	});
}
