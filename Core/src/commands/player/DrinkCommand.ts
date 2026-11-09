import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandDrinkCancelDrink,
	CommandDrinkNoAvailablePotion,
	CommandDrinkPacketReq
} from "../../../../Lib/src/packets/commands/CommandDrinkPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	InventorySlot, InventorySlots
} from "../../core/database/game/models/InventorySlot";
import { Potion } from "../../data/Potion";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	checkDrinkPotionMissions, consumePotion, toItemWithDetails
} from "../../core/utils/ItemUtils";
import {
	ReactionCollectorDrink,
	ReactionCollectorDrinkReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { ItemNature } from "../../../../Lib/src/constants/ItemConstants";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { withLockedPlayerAndMissionsSafe } from "../../core/utils/withLockedPlayerAndMissionsSafe";

const DRINK_REQUIREMENTS = {
	notBlocked: true,
	disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
	whereAllowed: [WhereAllowed.CONTINENT]
};

async function getDrinkablePotions(player: Player): Promise<InventorySlot[]> {
	return (await InventorySlots.getOfPlayer(player.id)).filter(item => {
		const potion = item.getItem() as Potion;
		return item.itemId !== 0
			&& item.isPotion()
			&& !potion.isFightPotion()
			&& (potion.nature !== ItemNature.TIME_SPEEDUP || !player.insideCity);
	});
}

async function drinkSelectedPotionUnderLock(response: CrowniclesPacket[], player: Locked<Player>, expectedSlot: InventorySlot, context: PacketContext): Promise<void> {
	if (!await CommandUtils.verifyCommandRequirements(player, context, response, DRINK_REQUIREMENTS)) {
		return;
	}
	const potionSlot = (await getDrinkablePotions(player)).find(slot => slot.slot === expectedSlot.slot && slot.itemId === expectedSlot.itemId);
	if (!potionSlot) {
		response.push(makePacket(CommandDrinkNoAvailablePotion, {}));
		return;
	}
	const potion = potionSlot.getItem() as Potion;
	await consumePotion(response, potion, player, await InventorySlots.getPlayerActiveObjects(player.id));
	await player.drinkPotion(potionSlot.slot);
	await player.save();
	await checkDrinkPotionMissions(response, player, potion, await InventorySlots.getOfPlayer(player.id));
}

export default class DrinkCommand {
	@commandRequires(CommandDrinkPacketReq, DRINK_REQUIREMENTS)
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandDrinkPacketReq, context: PacketContext): Promise<void> {
		const potions = await getDrinkablePotions(player);

		if (potions.length === 0) {
			response.push(makePacket(CommandDrinkNoAvailablePotion, {}));
			return;
		}

		const collector = new ReactionCollectorDrink(potions.map(i => toItemWithDetails(player, i.getItem()!, i.itemLevel, i.itemEnchantmentId)));

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DRINK);

			const reaction = collector.getFirstReaction();
			if (!reaction || reaction.reaction.type === ReactionCollectorRefuseReaction.name) {
				response.push(makePacket(CommandDrinkCancelDrink, {}));
				return;
			}

			const potionDetails = (reaction.reaction.data as ReactionCollectorDrinkReaction).potion;
			const potionSlot = potions.find(p => p.itemId === potionDetails.id && p.itemCategory === potionDetails.itemCategory)!;
			await withLockedPlayerAndMissionsSafe(player, "DrinkCommand confirmation", lockedPlayer => drinkSelectedPotionUnderLock(response, lockedPlayer, potionSlot, context));
		};

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.DRINK)
			.build();

		response.push(collectorPacket);
	}
}
