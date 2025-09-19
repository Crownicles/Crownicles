import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { ItemEnchantment } from "../../../../../../Lib/src/types/ItemEnchantment";
import {
	InventorySlot, InventorySlots
} from "../../../../core/database/game/models/InventorySlot";

export const commandInfo: ITestCommand = {
	name: "enchant",
	commandFormat: "<weapon/armor> <enchant id>",
	typeWaited: {
		"weapon/armor": TypeKey.STRING,
		"enchant id": TypeKey.STRING
	},
	description: `Permet d'enchanter l'objet équipé dans la catégorie donnée. Enchantements disponibles :\n${
		ItemEnchantment.getAllEnchantments().map(e => `- ${e.id}`)
			.join("\n")}`
};

const enchantTestCommand: ExecuteTestCommandLike = async (player, args) => {
	let itemSlot: InventorySlot;

	if (args[0] === "weapon") {
		itemSlot = await InventorySlots.getMainWeaponSlot(player.id);
	}
	else if (args[0] === "armor") {
		itemSlot = await InventorySlots.getMainArmorSlot(player.id);
	}
	else {
		throw Error("Catégorie inconnue. Elle doit être 'weapon' ou 'armor'");
	}

	if (itemSlot.itemId === 0) {
		throw Error("Vous n'avez pas d'objet équipé dans cette catégorie.");
	}

	if (!ItemEnchantment.getById(args[1])) {
		throw Error("Aucun enchantement n'existe avec cet id. Faites `/test help enchant` pour voir la liste des enchantements.");
	}

	itemSlot.itemEnchantmentId = args[1];
	await itemSlot.save();
	return `Vous avez enchanté votre objet équipé dans la catégorie "${args[0]}" avec l'enchantement "${args[1]}".`;
};

commandInfo.execute = enchantTestCommand;
