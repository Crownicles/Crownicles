import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandEquipPacketReq, CommandEquipErrorNoItem, EquipCategoryData
} from "../../../../Lib/src/packets/commands/CommandEquipPacket";
import {
	InventorySlot, InventorySlots
} from "../../core/database/game/models/InventorySlot";
import { InventoryInfos } from "../../core/database/game/models/InventoryInfo";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { sortPlayerItemList } from "../../core/utils/ItemUtils";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { ReactionCollectorEquip } from "../../../../Lib/src/packets/interaction/ReactionCollectorEquip";

/**
 * Build category data from player's inventory.
 */
export function buildEquipCategoryData(
	player: Player,
	inventorySlots: InventorySlot[],
	slotLimits: Map<ItemCategory, number>
): EquipCategoryData[] {
	const categories: EquipCategoryData[] = [];

	for (const category of [
		ItemCategory.WEAPON,
		ItemCategory.ARMOR,
		ItemCategory.POTION,
		ItemCategory.OBJECT
	]) {
		const equippedSlot = inventorySlots.find(s => s.itemCategory === category && s.isEquipped());
		const reserveSlots = sortPlayerItemList(
			inventorySlots.filter(s => s.itemCategory === category && !s.isEquipped() && s.itemId !== 0)
		);

		// Skip categories with nothing to show
		const hasEquipped = equippedSlot && equippedSlot.itemId !== 0;
		if (!hasEquipped && reserveSlots.length === 0) {
			continue;
		}

		categories.push({
			category,
			equippedItem: hasEquipped
				? { details: equippedSlot.itemWithDetails(player) }
				: null,
			reserveItems: reserveSlots.map(slot => ({
				slot: slot.slot,
				details: slot.itemWithDetails(player)
			})),
			maxReserveSlots: slotLimits.get(category) ?? 0
		});
	}

	return categories;
}

export default class EquipCommand {
	@commandRequires(CommandEquipPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandEquipPacketReq, context: PacketContext): Promise<void> {
		const inventorySlots = await InventorySlots.getOfPlayer(player.id);
		const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);

		const slotLimits = new Map<ItemCategory, number>([
			[ItemCategory.WEAPON, inventoryInfo.slotLimitForCategory(ItemCategory.WEAPON)],
			[ItemCategory.ARMOR, inventoryInfo.slotLimitForCategory(ItemCategory.ARMOR)],
			[ItemCategory.POTION, inventoryInfo.slotLimitForCategory(ItemCategory.POTION)],
			[ItemCategory.OBJECT, inventoryInfo.slotLimitForCategory(ItemCategory.OBJECT)]
		]);

		const categories = buildEquipCategoryData(player, inventorySlots, slotLimits);

		if (categories.length === 0) {
			response.push(makePacket(CommandEquipErrorNoItem, {}));
			return;
		}

		const collector = new ReactionCollectorEquip(categories);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			() => {
				BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.EQUIP);
			}
		)
			.block(player.keycloakId, BlockingConstants.REASONS.EQUIP)
			.build();

		response.push(packet);
	}
}
