import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { InventoryInfos } from "../../../../core/database/game/models/InventoryInfo";
import { ItemCategory } from "../../../../../../Lib/src/constants/ItemConstants";

export const commandInfo: ITestCommand = {
	name: "slots",
	commandFormat: "<category [0-3]> <number>",
	typeWaited: {
		"category [0-3]": TypeKey.INTEGER,
		"number": TypeKey.INTEGER
	},
	description: "Modifie le nombre d'emplacements d'inventaire pour une catégorie d'objets. Catégories : 0=armes, 1=armures, 2=potions, 3=objets.",
	argSuggestions: {
		"category [0-3]": ["0", "1", "2", "3"],
		"number": ["0", "1", "2", "3", "4"]
	},
	fullSuggestions: [
		"0 0", "0 1", "0 2", "0 3", "0 4",
		"1 0", "1 1", "1 2", "1 3", "1 4",
		"2 0", "2 1", "2 2", "2 3", "2 4",
		"3 0", "3 1", "3 2", "3 3", "3 4"
	]
};

/**
 * Set the weapon of the player
 */
const slotsTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const slots = parseInt(args[1], 10);
	if (slots >= 5 || slots < 0) {
		throw Error("Argument slots invalide. Doit être compris entre 0 et 5");
	}
	let category;
	const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);

	switch (parseInt(args[0], 10)) {
		case ItemCategory.WEAPON:
			inventoryInfo.weaponSlots = slots;
			category = "armes";
			break;
		case ItemCategory.ARMOR:
			inventoryInfo.armorSlots = slots;
			category = "armures";
			break;
		case ItemCategory.POTION:
			inventoryInfo.potionSlots = slots;
			category = "potions";
			break;
		case ItemCategory.OBJECT:
			inventoryInfo.objectSlots = slots;
			category = "objets";
			break;
		default:
			break;
	}

	await inventoryInfo.save();

	return `Vous avez désormais ${slots} emplacements pour les ${category} !`;
};

commandInfo.execute = slotsTestCommand;
