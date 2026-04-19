import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import {
	InventorySlot, InventorySlots
} from "../../../../core/database/game/models/InventorySlot";

export const commandInfo: ITestCommand = {
	name: "disenchant",
	commandFormat: "<weapon/armor>",
	typeWaited: {
		"weapon/armor": TypeKey.STRING
	},
	description: "Permet de désenchanter l'objet équipé dans la catégorie donnée."
};

const enchantTestCommand: ExecuteTestCommandLike = async (player, args) => {
	let itemSlot: InventorySlot;

	if (args[0] === "weapon") {
		itemSlot = (await InventorySlots.getMainWeaponSlot(player.id))!;
	}
	else if (args[0] === "armor") {
		itemSlot = (await InventorySlots.getMainArmorSlot(player.id))!;
	}
	else {
		throw Error("Catégorie inconnue. Elle doit être 'weapon' ou 'armor'");
	}

	if (itemSlot.itemId === 0) {
		throw Error("Vous n'avez pas d'objet équipé dans cette catégorie.");
	}

	itemSlot.itemEnchantmentId = null;
	await itemSlot.save();
	return `Vous avez désenchanté votre objet équipé dans la catégorie "${args[0]}".`;
};

commandInfo.execute = enchantTestCommand;
