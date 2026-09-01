import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	getSlotCountForCategory,
	type ChestSlotsPerCategory
} from "../../../../Lib/src/types/HomeFeatures";
import {
	CrowniclesPacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { Badge } from "../../../../Lib/src/types/Badge";
import { crowniclesInstance } from "../../app";
import type { GenericItem } from "../../data/GenericItem";
import { LeagueDataController } from "../../data/League";
import {
	InventoryInfo, InventoryInfos
} from "../database/game/models/InventoryInfo";
import {
	InventorySlot, InventorySlots
} from "../database/game/models/InventorySlot";
import { Homes } from "../database/game/models/Home";
import Player from "../database/game/models/Player";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import {
	generateRandomLootEnchantment, generateRandomLootLevel
} from "../utils/ItemUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

type TournamentRewardItem = {
	item: GenericItem;
	itemLevel: number;
	itemEnchantmentId: string | null;
};

type InventoryCapacity = {
	slots: InventorySlot[];
	info: InventoryInfo;
	bonus?: ChestSlotsPerCategory;
};

function getAvailableSlotsForCategory(inventory: InventoryCapacity, category: ItemCategory): number {
	const slotsLimit = inventory.info.slotLimitForCategory(category)
		+ (inventory.bonus ? getSlotCountForCategory(inventory.bonus, category) : 0);
	const categorySlots = inventory.slots.filter(slot => slot.itemCategory === category && slot.slot < slotsLimit);
	const emptyEquippedSlot = categorySlots.some(slot => slot.isEquipped() && slot.itemId === 0);
	return Math.max(0, slotsLimit - categorySlots.length + (emptyEquippedSlot ? 1 : 0));
}

async function hasInventorySpaceForItems(playerId: number, rewardItems: TournamentRewardItem[]): Promise<boolean> {
	const inventory: InventoryCapacity = {
		slots: await InventorySlots.getOfPlayer(playerId),
		info: await InventoryInfos.getOfPlayer(playerId),
		bonus: (await Homes.getOfPlayer(playerId))?.getLevel()?.features.inventoryBonus
	};
	const availableSlots = new Map<ItemCategory, number>();

	for (const rewardItem of rewardItems) {
		const category = rewardItem.item.getCategory();
		let available = availableSlots.get(category);
		if (available === undefined) {
			available = getAvailableSlotsForCategory(inventory, category);
		}
		if (available === 0) {
			return false;
		}
		availableSlots.set(category, available - 1);
	}
	return true;
}

async function applyTournamentRewardUnderLock(
	player: Player,
	participant: Locked<TournamentParticipant>
): Promise<TournamentRewardItem[] | null> {
	const response: CrowniclesPacket[] = [];
	const league = LeagueDataController.instance.getById(participant.normalLeagueId) ?? player.getLeague();
	const rewardItems = Array.from({ length: participant.rewardItemCount }, (): TournamentRewardItem => {
		const item = league.generateRewardItem();
		return {
			item,
			itemLevel: generateRandomLootLevel(),
			itemEnchantmentId: generateRandomLootEnchantment(item)
		};
	});
	if (!await hasInventorySpaceForItems(player.id, rewardItems)) {
		CrowniclesLogger.warn(`Tournament item reward is pending because player ${player.id} inventory is full`);
		return null;
	}
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
	for (const rewardItem of rewardItems) {
		const added = await player.giveItem(rewardItem.item, rewardItem.itemLevel, rewardItem.itemEnchantmentId);
		if (!added) {
			throw new Error(`Tournament item reward could not fit in player ${player.id} inventory`);
		}
	}
	participant.rewardGrantedAt = new Date();
	await participant.save();
	return rewardItems;
}

async function distributeParticipantReward(participant: TournamentParticipant): Promise<void> {
	try {
		const rewardItems = await withLockedEntities(
			[Player.lockKey(participant.playerId), TournamentParticipant.lockKey(participant.id)] as const,
			async ([player, lockedParticipant]) => {
				if (lockedParticipant.rewardGrantedAt) {
					return null;
				}
				return await applyTournamentRewardUnderLock(player, lockedParticipant);
			}
		);
		if (!rewardItems) {
			return;
		}
		try {
			await Promise.all(rewardItems.map(({ item }) =>
				crowniclesInstance?.logsDatabase.logItemGain(participant.keycloakId, item)));
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Tournament item reward log for participant ${participant.id} failed`, error);
		}
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(`Tournament reward skipped because player ${participant.playerId} no longer exists`);
		}
		else {
			CrowniclesLogger.errorWithObj(`Tournament reward for participant ${participant.id} failed`, error);
		}
	}
}

export async function distributeRewards(tournamentId: number): Promise<void> {
	const participants = await TournamentParticipant.findAll({ where: { tournamentId } });
	for (const participant of participants) {
		if (!participant.rewardGrantedAt) {
			await distributeParticipantReward(participant);
		}
	}
	const remaining = await TournamentParticipant.count({
		where: {
			tournamentId,
			rewardGrantedAt: null
		}
	});
	if (remaining === 0) {
		await Tournament.withLocked(tournamentId, async tournament => {
			tournament.rewardsDistributed = true;
			await tournament.save();
		});
	}
}
