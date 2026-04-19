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
 */
export async function handleInnMealReaction(
	player: Player,
	reaction: ReactionCollectorInnMealReaction,
	response: CrowniclesPacket[]
): Promise<void> {
	if (player.canEat()) {
		if (reaction.meal.price > player.money) {
			response.push(makePacket(CommandReportNotEnoughMoneyRes, { missingMoney: reaction.meal.price - player.money }));
			return;
		}

		player.addEnergy(reaction.meal.energy, NumberChangeReason.INN_MEAL, await InventorySlots.getPlayerActiveObjects(player.id));
		player.eatMeal();
		await player.spendMoney({
			response,
			amount: reaction.meal.price,
			reason: NumberChangeReason.INN_MEAL
		});
		await player.save();
		response.push(makePacket(CommandReportEatInnMealRes, {
			energy: reaction.meal.energy,
			moneySpent: reaction.meal.price
		}));
	}
	else {
		response.push(makePacket(CommandReportEatInnMealCooldownRes, {}));
	}
}

/**
 * Handle inn room reaction — player rents a room at an inn
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

	await player.addHealth({
		amount: reaction.room.health,
		response,
		reason: NumberChangeReason.INN_ROOM,
		playerActiveObjects: await InventorySlots.getPlayerActiveObjects(player.id)
	});
	await player.spendMoney({
		response,
		amount: reaction.room.price,
		reason: NumberChangeReason.INN_ROOM
	});
	await TravelTime.applyEffect(player, Effect.SLEEPING, 0, new Date(), NumberChangeReason.INN_ROOM);
	await player.save();
	response.push(makePacket(CommandReportSleepRoomRes, {
		roomId: reaction.room.roomId,
		health: reaction.room.health,
		moneySpent: reaction.room.price
	}));
}
