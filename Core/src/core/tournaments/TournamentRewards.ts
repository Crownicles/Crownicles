import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { Badge } from "../../../../Lib/src/types/Badge";
import { TournamentStatuses } from "../../../../Lib/src/types/Tournament";
import { ItemFoundPacket } from "../../../../Lib/src/packets/events/ItemFoundPacket";
import { crowniclesInstance } from "../../app";
import type { GenericItem } from "../../data/GenericItem";
import Player from "../database/game/models/Player";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import { findLatestTournamentForGuild } from "./TournamentQueries";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	generateRandomItem, generateRandomLootEnchantment, generateRandomLootLevel,
	toItemWithDetails
} from "../utils/ItemUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

type TournamentRewardItem = {
	item: GenericItem;
	itemLevel: number;
	itemEnchantmentId: string | null;
};

type TournamentRewardClaim = {
	tournament: Tournament;
	participant: TournamentParticipant;
};

const NON_POTION_ITEM_CATEGORIES = [
	ItemCategory.WEAPON,
	ItemCategory.ARMOR,
	ItemCategory.OBJECT
] as const;

function generateTournamentRewardItem(participant: TournamentParticipant): GenericItem {
	if (participant.finalRank === null || participant.finalRank > TournamentConstants.REWARD_ITEM_TOP_RANK_LIMIT) {
		return generateRandomItem({});
	}
	const category = NON_POTION_ITEM_CATEGORIES[RandomUtils.randInt(0, NON_POTION_ITEM_CATEGORIES.length)];
	return generateRandomItem({ itemCategory: category });
}

async function applyTournamentRewardUnderLock(
	player: Player,
	participant: Locked<TournamentParticipant>,
	response: CrowniclesPacket[]
): Promise<TournamentRewardItem> {
	const item = generateTournamentRewardItem(participant);
	const rewardItem: TournamentRewardItem = {
		item,
		itemLevel: generateRandomLootLevel(),
		itemEnchantmentId: generateRandomLootEnchantment(item)
	};
	if (!await player.giveItem(rewardItem.item, rewardItem.itemLevel, rewardItem.itemEnchantmentId)) {
		throw new Error(`Tournament item reward could not fit in player ${player.id} inventory`);
	}
	response.push(makePacket(ItemFoundPacket, {
		itemWithDetails: toItemWithDetails(
			player,
			rewardItem.item,
			rewardItem.itemLevel,
			rewardItem.itemEnchantmentId
		)
	}));
	await player.addExperience({
		amount: participant.rewardXp,
		response,
		reason: NumberChangeReason.TOURNAMENT_REWARD
	});
	await player.addMoney({
		amount: participant.rewardMoney,
		response,
		reason: NumberChangeReason.TOURNAMENT_REWARD,
		ignoreBlessing: true
	});
	if (participant.isWinner) {
		await PlayerBadgesManager.addBadge(player.id, Badge.TOURNAMENT_WINNER);
	}
	participant.rewardGrantedAt = new Date();
	await participant.save();
	return rewardItem;
}

async function markRewardsAsDistributed(tournamentId: number): Promise<void> {
	const remaining = await TournamentParticipant.count({
		where: {
			tournamentId,
			rewardGrantedAt: null
		}
	});
	if (remaining !== 0) {
		return;
	}
	await Tournament.withLocked(tournamentId, async tournament => {
		if (tournament.status !== TournamentStatuses.COMPLETED || tournament.rewardsDistributed) {
			return;
		}
		tournament.rewardsDistributed = true;
		await tournament.save();
	});
}

async function findTournamentRewardClaim(
	context: PacketContext,
	player: Player
): Promise<TournamentRewardClaim | null> {
	const tournament = await findLatestTournamentForGuild(context.frontEndSubOrigin);
	if (!tournament || tournament.status !== TournamentStatuses.COMPLETED) {
		return null;
	}
	const participant = await TournamentParticipant.findOne({
		where: {
			tournamentId: tournament.id,
			playerId: player.id
		}
	});
	if (!participant || participant.rewardGrantedAt) {
		return null;
	}
	return {
		tournament,
		participant
	};
}

async function claimRewardForParticipant(
	claim: TournamentRewardClaim,
	response: CrowniclesPacket[],
	responseStart: number
): Promise<TournamentRewardItem | null> {
	try {
		return await withLockedEntities(
			[Player.lockKey(claim.participant.playerId), TournamentParticipant.lockKey(claim.participant.id)] as const,
			async ([lockedPlayer, lockedParticipant]) => {
				if (lockedParticipant.rewardGrantedAt) {
					return null;
				}
				return await applyTournamentRewardUnderLock(lockedPlayer, lockedParticipant, response);
			}
		);
	}
	catch (error) {
		response.splice(responseStart);
		if (error instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(`Tournament reward skipped because player ${claim.participant.playerId} no longer exists`);
		}
		else {
			CrowniclesLogger.errorWithObj(`Tournament reward claim for participant ${claim.participant.id} failed`, error);
		}
		return null;
	}
}

async function logClaimedReward(claim: TournamentRewardClaim, rewardItem: TournamentRewardItem): Promise<void> {
	try {
		await crowniclesInstance?.logsDatabase.logItemGain(claim.participant.keycloakId, rewardItem.item);
	}
	catch (error) {
		CrowniclesLogger.errorWithObj(`Tournament item reward log for participant ${claim.participant.id} failed`, error);
	}
}

async function markClaimedRewardsAsDistributed(claim: TournamentRewardClaim): Promise<void> {
	try {
		await markRewardsAsDistributed(claim.tournament.id);
	}
	catch (error) {
		CrowniclesLogger.errorWithObj(`Tournament reward distribution state update for tournament ${claim.tournament.id} failed`, error);
	}
}

export async function claimTournamentReward(
	context: PacketContext,
	response: CrowniclesPacket[],
	player: Player
): Promise<void> {
	const claim = await findTournamentRewardClaim(context, player);
	if (!claim) {
		return;
	}
	const responseStart = response.length;
	const rewardItem = await claimRewardForParticipant(claim, response, responseStart);
	if (!rewardItem) {
		return;
	}
	await logClaimedReward(claim, rewardItem);
	await markClaimedRewardsAsDistributed(claim);
}
