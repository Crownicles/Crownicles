import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportTokenMerchantBoughtRes,
	CommandReportTokenMerchantCannotAffordRes,
	CommandReportTokenMerchantCharityAlreadyUsedRes,
	CommandReportTokenMerchantCharityRes,
	CommandReportTokenMerchantFullRes,
	CommandReportTokenMerchantRefuseRes,
	CommandReportTokenMerchantTooMuchRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	ReactionCollectorTokenMerchant,
	ReactionCollectorTokenMerchantBuyReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorTokenMerchant";
import {
	Player
} from "../database/game/models/Player";
import { withLockedPlayerAndMissions } from "../utils/withLockedPlayerAndMissions";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import { MissionsController } from "../missions/MissionsController";
import { crowniclesInstance } from "../../app";

/**
 * How many additional tokens the player can still buy, considering the
 * daily and weekly buyout limits and the player token cap.
 */
interface TokenMerchantAllowance {
	maxTokensToAdd: number;
	tokensBoughtToday: number;
	tokensBoughtThisWeek: number;
}

/**
 * Compute how many tokens the player is still allowed to buy right now.
 */
async function computeAllowance(player: Player): Promise<TokenMerchantAllowance> {
	const tokensBoughtToday = await LogsReadRequests.getAmountOfTokensBoughtByPlayerToday(player.keycloakId);
	const tokensBoughtThisWeek = await LogsReadRequests.getAmountOfTokensBoughtByPlayerThisWeek(player.keycloakId);

	const remainingDaily = ShopConstants.MAX_DAILY_TOKEN_BUYOUTS - tokensBoughtToday;
	const remainingWeekly = ShopConstants.MAX_WEEKLY_TOKEN_BUYOUTS - tokensBoughtThisWeek;
	const remainingByCap = TokensConstants.MAX - player.tokens;

	return {
		maxTokensToAdd: Math.max(0, Math.min(remainingDaily, remainingWeekly, remainingByCap)),
		tokensBoughtToday,
		tokensBoughtThisWeek
	};
}

/**
 * Build the list of purchasable token bundles, clamped to what the player
 * can afford (money), is allowed to buy (limits) and can hold (cap).
 */
function buildPurchasableAmounts(player: Player, maxTokensToAdd: number): number[] {
	const maxAffordableByMoney = Math.floor(player.money / ShopConstants.TOKEN_PRICE);
	const clamped = ShopConstants.TOKEN_PURCHASE_AMOUNTS
		.map(amount => Math.min(amount, maxTokensToAdd, maxAffordableByMoney))
		.filter(amount => amount > 0);
	return [...new Set(clamped)];
}

/**
 * Persist a token purchase atomically.
 *
 * Concurrency: the read-validate-spend-add sequence on `player.money` and
 * `player.tokens` runs inside `withLockedPlayerAndMissions` so two concurrent
 * purchases cannot both pass the affordability / cap / limit checks on the
 * same stale snapshot. The buyout is logged inside the lock so a following
 * (serialized) purchase observes the updated daily/weekly count.
 */
async function buyTokens(
	player: Player,
	amount: number,
	response: CrowniclesPacket[]
): Promise<void> {
	await withLockedPlayerAndMissions(player.id, async lockedPlayer => {
		const tokensBoughtToday = await LogsReadRequests.getAmountOfTokensBoughtByPlayerToday(lockedPlayer.keycloakId);
		const tokensBoughtThisWeek = await LogsReadRequests.getAmountOfTokensBoughtByPlayerThisWeek(lockedPlayer.keycloakId);

		if (tokensBoughtToday + amount > ShopConstants.MAX_DAILY_TOKEN_BUYOUTS
			|| tokensBoughtThisWeek + amount > ShopConstants.MAX_WEEKLY_TOKEN_BUYOUTS) {
			response.push(makePacket(CommandReportTokenMerchantTooMuchRes, {}));
			return;
		}

		if (lockedPlayer.tokens + amount > TokensConstants.MAX) {
			response.push(makePacket(CommandReportTokenMerchantFullRes, {}));
			return;
		}

		const price = amount * ShopConstants.TOKEN_PRICE;
		if (lockedPlayer.money < price) {
			response.push(makePacket(CommandReportTokenMerchantCannotAffordRes, {}));
			return;
		}

		await lockedPlayer.spendMoney({
			amount: price,
			response,
			reason: NumberChangeReason.SHOP
		});
		await lockedPlayer.save();
		await lockedPlayer.addTokens({
			amount,
			response,
			reason: NumberChangeReason.SHOP
		});
		await lockedPlayer.save();

		await MissionsController.update(lockedPlayer, response, {
			missionId: "buyTokensFromShop",
			count: amount
		});
		await crowniclesInstance?.logsDatabase.logClassicalShopBuyout(lockedPlayer.keycloakId, ShopItemType.TOKEN, amount);

		response.push(makePacket(CommandReportTokenMerchantBoughtRes, { amount }));
	});
}

/**
 * Gift free tokens to a broke player with no tokens, at most once per week.
 *
 * Concurrency: the check-then-grant sequence runs inside `withLockedPlayerAndMissions`
 * so two concurrent calls for the same player are serialized. The weekly
 * dedup is read from and written to the logs database (as a
 * `ShopItemType.TOKEN_CHARITY` buyout), mirroring how the token buyout
 * daily/weekly limits are enforced. The log write happens inside the lock
 * so a following (serialized) call observes the already-granted charity.
 */
async function giveCharity(
	player: Player,
	response: CrowniclesPacket[]
): Promise<void> {
	await withLockedPlayerAndMissions(player.id, async lockedPlayer => {
		const charityReceivedThisWeek = await LogsReadRequests.getTokenCharityCountReceivedByPlayerThisWeek(lockedPlayer.keycloakId);
		if (charityReceivedThisWeek > 0) {
			response.push(makePacket(CommandReportTokenMerchantCharityAlreadyUsedRes, {}));
			return;
		}

		await lockedPlayer.addTokens({
			amount: TokensConstants.MERCHANT_CHARITY_AMOUNT,
			response,
			reason: NumberChangeReason.TOKEN_MERCHANT_CHARITY
		});
		await lockedPlayer.save();

		await crowniclesInstance?.logsDatabase.logClassicalShopBuyout(lockedPlayer.keycloakId, ShopItemType.TOKEN_CHARITY, TokensConstants.MERCHANT_CHARITY_AMOUNT);

		response.push(makePacket(CommandReportTokenMerchantCharityRes, { amount: TokensConstants.MERCHANT_CHARITY_AMOUNT }));
	});
}

/**
 * Create the token merchant collector offering the purchasable bundles.
 */
function createTokenMerchantCollector(
	player: Player,
	amounts: number[],
	context: PacketContext,
	response: CrowniclesPacket[]
): void {
	const collector = new ReactionCollectorTokenMerchant(ShopConstants.TOKEN_PRICE, player.money, player.tokens, amounts);

	const endCallback: EndCallback = async (collector, response) => {
		const reaction = collector.getFirstReaction();

		if (reaction && reaction.reaction.type === ReactionCollectorTokenMerchantBuyReaction.name) {
			const buyReaction = reaction.reaction.data as ReactionCollectorTokenMerchantBuyReaction;
			await buyTokens(player, buyReaction.amount, response);
		}
		else {
			response.push(makePacket(CommandReportTokenMerchantRefuseRes, {}));
		}

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.REPORT_USE_TOKENS);
	};

	const collectorPacket = new ReactionCollectorInstance(
		collector,
		context,
		{
			allowedPlayerKeycloakIds: [player.keycloakId],
			reactionLimit: 1,
			mainPacket: false
		},
		endCallback
	)
		.block(player.keycloakId, BlockingConstants.REASONS.REPORT_USE_TOKENS)
		.build();

	response.push(collectorPacket);
}

/**
 * Entry point: an eligible player tried to advance with tokens but lacks
 * enough of them. Offer the token merchant, or — when the player has no
 * tokens and cannot even afford one — gift a few tokens once per week.
 */
export async function openTokenMerchant(
	player: Player,
	context: PacketContext,
	response: CrowniclesPacket[]
): Promise<void> {
	const { maxTokensToAdd } = await computeAllowance(player);
	const amounts = buildPurchasableAmounts(player, maxTokensToAdd);

	if (amounts.length > 0) {
		createTokenMerchantCollector(player, amounts, context, response);
		return;
	}

	// No bundle is purchasable: figure out why and answer accordingly.
	if (maxTokensToAdd <= 0) {
		// Daily/weekly buyout limit reached (cap cannot be the cause here)
		response.push(makePacket(CommandReportTokenMerchantTooMuchRes, {}));
		return;
	}

	// The player simply cannot afford a single token
	if (player.tokens === 0) {
		await giveCharity(player, response);
		return;
	}

	response.push(makePacket(CommandReportTokenMerchantCannotAffordRes, {}));
}
