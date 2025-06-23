import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandDrinkCancelDrink,
	CommandDrinkConsumePotionRes,
	CommandDrinkNoActiveObjectError,
	CommandDrinkObjectIsActiveDuringFights,
	CommandDrinkPacketReq
} from "../../../../Lib/src/packets/commands/CommandDrinkPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { Potion } from "../../data/Potion";
import { InventoryConstants } from "../../../../Lib/src/constants/InventoryConstants";
import { ItemNature } from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../../core/maps/TravelTime";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	checkDrinkPotionMissions, toItemWithDetails
} from "../../core/utils/ItemUtils";
import { ReactionCollectorDrink } from "../../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";

/**
 * Consumes the given potion
 * @param response
 * @param potion
 * @param player
 */
async function consumePotion(response: CrowniclesPacket[], potion: Potion, player: Player): Promise<void> {
	switch (potion.nature) {
		case ItemNature.HEALTH:
			response.push(makePacket(CommandDrinkConsumePotionRes, { health: potion.power }));
			await player.addHealth(potion.power, response, NumberChangeReason.DRINK);
			break;
		case ItemNature.ENERGY:
			response.push(makePacket(CommandDrinkConsumePotionRes, { energy: potion.power }));
			player.addEnergy(potion.power, NumberChangeReason.DRINK);
			break;
		case ItemNature.TIME_SPEEDUP:
			await TravelTime.timeTravel(player, potion.power, NumberChangeReason.DRINK);
			response.push(makePacket(CommandDrinkConsumePotionRes, { time: potion.power }));
			break;
		case ItemNature.NONE:
			response.push(makePacket(CommandDrinkConsumePotionRes, {}));
			break;
		default:
			break;
	}
	await player.drinkPotion();

	await player.save();
}

/**
 * Returns the callback for the drink command
 * @param force
 */
function drinkPotionCallback(
	force: boolean
): (collector: ReactionCollectorInstance, response: CrowniclesPacket[], player: Player, potion: Potion) => Promise<void> {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[], player: Player, potion: Potion): Promise<void> => {
		if (!force) {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DRINK);
			const firstReaction = collector.getFirstReaction();
			if (!firstReaction || collector.getFirstReaction().reaction.type === ReactionCollectorRefuseReaction.name) {
				response.push(makePacket(CommandDrinkCancelDrink, {}));
				return;
			}
		}

		if (potion.id === InventoryConstants.POTION_DEFAULT_ID) {
			response.push(makePacket(CommandDrinkNoActiveObjectError, {}));
			return;
		}

		await consumePotion(response, potion, player);
		await checkDrinkPotionMissions(response, player, potion, await InventorySlots.getOfPlayer(player.id));
	};
}

export default class DrinkCommand {
	@commandRequires(CommandDrinkPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandDrinkPacketReq, context: PacketContext): Promise<void> {
		const potion = (await InventorySlots.getMainPotionSlot(player.id))?.getItem() as Potion;

		if (!potion || potion.id === InventoryConstants.POTION_DEFAULT_ID) {
			response.push(makePacket(CommandDrinkNoActiveObjectError, {}));
			return;
		}

		// Those objects are active only during fights
		if (potion.nature === ItemNature.SPEED || potion.nature === ItemNature.DEFENSE || potion.nature === ItemNature.ATTACK) {
			response.push(makePacket(CommandDrinkObjectIsActiveDuringFights, {}));
			return;
		}

		const drinkPotion = drinkPotionCallback(packet.force);

		if (packet.force) {
			await drinkPotion(null, response, player, potion);
			return;
		}

		const collector = new ReactionCollectorDrink(toItemWithDetails(potion));

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			await drinkPotion(collector, response, await player.reload(), potion);
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
