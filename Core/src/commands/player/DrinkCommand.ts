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
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
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


export default class DrinkCommand {
	@commandRequires(CommandDrinkPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandDrinkPacketReq, context: PacketContext): Promise<void> {
		const potions = (await InventorySlots.getOfPlayer(player.id)).filter(item => item.isPotion() && !(item.getItem() as Potion).isFightPotion());

		if (potions.length === 0) {
			response.push(makePacket(CommandDrinkNoAvailablePotion, {}));
			return;
		}

		const collector = new ReactionCollectorDrink(potions.map(i => toItemWithDetails(i.getItem())));

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DRINK);

			const reaction = collector.getFirstReaction();
			if (!reaction || reaction.reaction.type === ReactionCollectorRefuseReaction.name) {
				response.push(makePacket(CommandDrinkCancelDrink, {}));
				return;
			}

			const potionDetails = (reaction.reaction.data as ReactionCollectorDrinkReaction).potion;
			const potion = potions.find(p => p.itemId === potionDetails.id && p.itemCategory === potionDetails.category).getItem() as Potion;
			await consumePotion(response, potion, player);
			await player.drinkPotion();
			await player.save();
			await checkDrinkPotionMissions(response, player, potion, await InventorySlots.getOfPlayer(player.id));
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
