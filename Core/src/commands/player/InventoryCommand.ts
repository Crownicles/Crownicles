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
import InventorySlot, { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { Potion } from "../../data/Potion";
import { ObjectItem } from "../../data/ObjectItem";
import { InventoryInfos } from "../../core/database/game/models/InventoryInfo";
import { MainItem } from "../../data/MainItem";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { PlayerTalismansManager } from "../../core/database/game/models/PlayerTalismans";
import { Materials } from "../../core/database/game/models/Material";
import { Homes } from "../../core/database/game/models/Home";
import { StatValues } from "../../../../Lib/src/types/StatValues";

function buildMainItemBackups(
	items: InventorySlot[],
	maxStats: StatValues
): {
	display: ReturnType<MainItem["getDisplayPacket"]>;
	slot: number;
}[] {
	return items.map(item => ({
		display: (item.getItem() as MainItem).getDisplayPacket(item.itemLevel, item.itemEnchantmentId ?? undefined, maxStats),
		slot: item.slot
	}));
}

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

		response.push(makePacket(CommandInventoryPacketRes, await buildInventoryData(toCheckPlayer)));
	}
}

async function buildInventoryData(toCheckPlayer: Player): Promise<CommandInventoryPacketRes> {
	const maxStatsValues = toCheckPlayer.getMaxStatsValue();
	const items = await InventorySlots.getOfPlayer(toCheckPlayer.id);
	const invInfo = await InventoryInfos.getOfPlayer(toCheckPlayer.id);
	const talismans = await PlayerTalismansManager.getOfPlayer(toCheckPlayer.id);
	const playerMaterials = await Materials.getPlayerMaterials(toCheckPlayer.id);
	const home = await Homes.getOfPlayer(toCheckPlayer.id);
	const homeBonus = home?.getLevel()?.features.inventoryBonus ?? {
		weapon: 0, armor: 0, potion: 0, object: 0
	};

	const weapon = items.find(item => item.isWeapon() && item.isEquipped())!;
	const armor = items.find(item => item.isArmor() && item.isEquipped())!;
	const potion = items.find(item => item.isPotion() && item.isEquipped())!;
	const object = items.find(item => item.isObject() && item.isEquipped())!;

	return {
		foundPlayer: true,
		keycloakId: toCheckPlayer.keycloakId,
		hasTalisman: talismans.hasTalisman,
		hasCloneTalisman: talismans.hasCloneTalisman,
		data: {
			weapon: (weapon.getItem() as MainItem).getDisplayPacket(weapon.itemLevel, weapon.itemEnchantmentId ?? undefined, maxStatsValues),
			armor: (armor.getItem() as MainItem).getDisplayPacket(armor.itemLevel, armor.itemEnchantmentId ?? undefined, maxStatsValues),
			potion: (potion.getItem() as Potion).getDisplayPacket(),
			object: (object.getItem() as ObjectItem).getDisplayPacket(maxStatsValues),
			backupWeapons: buildMainItemBackups(items.filter(item => item.isWeapon() && !item.isEquipped() && item.itemId !== 0), maxStatsValues),
			backupArmors: buildMainItemBackups(items.filter(item => item.isArmor() && !item.isEquipped() && item.itemId !== 0), maxStatsValues),
			backupPotions: items.filter(item => item.isPotion() && !item.isEquipped() && item.itemId !== 0).map(item => ({
				display: (item.getItem() as Potion).getDisplayPacket(), slot: item.slot
			})),
			backupObjects: items.filter(item => item.isObject() && !item.isEquipped() && item.itemId !== 0).map(item => ({
				display: (item.getItem() as ObjectItem).getDisplayPacket(maxStatsValues), slot: item.slot
			})),
			slots: {
				weapons: invInfo.weaponSlots + homeBonus.weapon,
				armors: invInfo.armorSlots + homeBonus.armor,
				potions: invInfo.potionSlots + homeBonus.potion,
				objects: invInfo.objectSlots + homeBonus.object
			},
			materials: playerMaterials
				.filter(m => m.quantity > 0)
				.map(m => ({
					materialId: m.materialId,
					quantity: m.quantity
				}))
		}
	};
}
