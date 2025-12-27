import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	CommandInventoryPacketReq,
	CommandInventoryPacketRes
} from "../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { Weapon } from "../../data/Weapon";
import { Armor } from "../../data/Armor";
import { Potion } from "../../data/Potion";
import { ObjectItem } from "../../data/ObjectItem";
import { InventoryInfos } from "../../core/database/game/models/InventoryInfo";
import { MainItem } from "../../data/MainItem";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";

export default class InventoryCommand {
	@commandRequires(CommandInventoryPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandInventoryPacketReq): Promise<void> {
		const toCheckPlayer = await Players.getAskedPlayer(packet.askedPlayer, player);

		if (!toCheckPlayer?.hasStartedToPlay()) {
			response.push(makePacket(CommandInventoryPacketRes, {
				foundPlayer: false
			}));
			return;
		}
		const maxStatsValues = toCheckPlayer.getMaxStatsValue();
		const items = await InventorySlots.getOfPlayer(toCheckPlayer.id);
		const invInfo = await InventoryInfos.getOfPlayer(toCheckPlayer.id);
		const equippedPotionSlot = items.find(item => item.isPotion() && item.isEquipped());

		response.push(makePacket(CommandInventoryPacketRes, {
			foundPlayer: true,
			keycloakId: toCheckPlayer.keycloakId,
			hasTalisman: toCheckPlayer.hasTalisman,
			hasCloneTalisman: toCheckPlayer.hasCloneTalisman,
			data: {
				weapon: (items.find(item => item.isWeapon() && item.isEquipped()).getItem() as MainItem).getDisplayPacket(maxStatsValues),
				armor: (items.find(item => item.isArmor() && item.isEquipped()).getItem() as MainItem).getDisplayPacket(maxStatsValues),
				potion: (equippedPotionSlot.getItem() as Potion).getDisplayPacket(maxStatsValues, equippedPotionSlot.remainingPotionUsages),
				object: (items.find(item => item.isObject() && item.isEquipped()).getItem() as ObjectItem).getDisplayPacket(maxStatsValues),
				backupWeapons: items.filter(item => item.isWeapon() && !item.isEquipped()).map(item =>
					({
						display: (item.getItem() as Weapon).getDisplayPacket(maxStatsValues), slot: item.slot
					})),
				backupArmors: items.filter(item => item.isArmor() && !item.isEquipped()).map(item =>
					({
						display: (item.getItem() as Armor).getDisplayPacket(maxStatsValues), slot: item.slot
					})),
				backupPotions: items.filter(item => item.isPotion() && !item.isEquipped()).map(item =>
					({
						display: (item.getItem() as Potion).getDisplayPacket(maxStatsValues, item.remainingPotionUsages), slot: item.slot
					})),
				backupObjects: items.filter(item => item.isObject() && !item.isEquipped()).map(item =>
					({
						display: (item.getItem() as ObjectItem).getDisplayPacket(maxStatsValues), slot: item.slot
					})),
				slots: {
					weapons: invInfo.weaponSlots,
					armors: invInfo.armorSlots,
					potions: invInfo.potionSlots,
					objects: invInfo.objectSlots
				}
			}
		}));
	}
}
