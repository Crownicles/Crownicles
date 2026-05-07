import { InventorySlots } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorInnMealReaction,
	ReactionCollectorInnRoomReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CommandReportEatInnMealCooldownRes,
	CommandReportEatInnMealRes,
	CommandReportNotEnoughMoneyRes,
	CommandReportSleepRoomRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";

/**
 * Handle inn meal reaction — player eats a meal at an inn
 *
 * Concurrency: the read-validate-spend-save sequence on `player.money`
 * runs inside `Player.withLocked` so two concurrent meal purchases
 * cannot both pass the affordability check on the same stale snapshot
 * and cause a lost-update on the player's wallet.
 */
export async function handleInnMealReaction(
	player: Player,
	reaction: ReactionCollectorInnMealReaction,
	response: CrowniclesPacket[]
): Promise<void> {
	if (!player.canEat()) {
		response.push(makePacket(CommandReportEatInnMealCooldownRes, {}));
		return;
	}
	if (reaction.meal.price > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.meal.price - player.money }));
		return;
	}

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);

	await Player.withLocked(player.id, async lockedPlayer => {
		/*
		 * Re-validate against the freshly-locked row: a concurrent
		 * meal purchase, room rental, blacksmith spend, etc. may have
		 * drained the wallet between the outer fast-fail and the lock
		 * acquisition.
		 */
		if (!lockedPlayer.canEat()) {
			response.push(makePacket(CommandReportEatInnMealCooldownRes, {}));
			return;
		}
		if (reaction.meal.price > lockedPlayer.money) {
			response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.meal.price - lockedPlayer.money }));
			return;
		}

		lockedPlayer.addEnergy(reaction.meal.energy, NumberChangeReason.INN_MEAL, playerActiveObjects);
		lockedPlayer.eatMeal();
		await lockedPlayer.spendMoney({
			response,
			amount: reaction.meal.price,
			reason: NumberChangeReason.INN_MEAL
		});
		await lockedPlayer.save();
		response.push(makePacket(CommandReportEatInnMealRes, {
			energy: reaction.meal.energy,
			moneySpent: reaction.meal.price
		}));
	});
}

/**
 * Handle inn room reaction — player rents a room at an inn
 *
 * Concurrency: the read-validate-spend-save sequence on `player.money`
 * runs inside `Player.withLocked` to prevent lost-updates when two
 * room rentals (or a room + a meal) run concurrently for the same
 * player.
 */
export async function handleInnRoomReaction(
	player: Player,
	reaction: ReactionCollectorInnRoomReaction,
	response: CrowniclesPacket[]
): Promise<void> {
	if (reaction.room.price > player.money) {
		response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.room.price - player.money }));
		return;
	}

	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);

	await Player.withLocked(player.id, async lockedPlayer => {
		if (reaction.room.price > lockedPlayer.money) {
			response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.room.price - lockedPlayer.money }));
			return;
		}

		await lockedPlayer.addHealth({
			amount: reaction.room.health,
			response,
			reason: NumberChangeReason.INN_ROOM,
			playerActiveObjects
		});
		await lockedPlayer.spendMoney({
			response,
			amount: reaction.room.price,
			reason: NumberChangeReason.INN_ROOM
		});
		await TravelTime.applyEffect(lockedPlayer, Effect.SLEEPING, 0, new Date(), NumberChangeReason.INN_ROOM);
		await lockedPlayer.save();
		response.push(makePacket(CommandReportSleepRoomRes, {
			roomId: reaction.room.roomId,
			health: reaction.room.health,
			moneySpent: reaction.room.price
		}));
	});
}
