import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { getItemByIdAndCategory } from "../../../../core/utils/ItemUtils";

export const commandInfo: ITestCommand = {
	name: "giveitem",
	commandFormat: "<category [0-3]> <item id>",
	typeWaited: {
		"category [0-3]": TypeKey.INTEGER,
		"item id": TypeKey.INTEGER
	},
	description: "Donne un objet spécifique au joueur. Catégories : 0=armes, 1=armures, 2=potions, 3=objets. Voir Core/resources/[category]/ pour les IDs",
	argSuggestions: {
		"category [0-3]": ["0", "1", "2", "3"],
		"item id": ["1", "5", "10", "20", "50", "100"]
	},
	fullSuggestions: [
		"0 1", "0 5", "0 10", "0 20", "0 50",
		"1 1", "1 5", "1 10", "1 20", "1 50",
		"2 1", "2 5", "2 10",
		"3 1", "3 5", "3 10", "3 20"
	]
};

/**
 * Set the weapon of the player
 */
const giveItemTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const itemId = parseInt(args[1], 10);
	const category = parseInt(args[0], 10);
	if (category < 0 || category > 3) {
		throw Error("Catégorie inconnue. Elle doit être en 0 et 3");
	}
	const item = getItemByIdAndCategory(itemId, category);
	if (!item) {
		throw Error("Aucun objet n'existe dans cette catégorie avec cet id");
	}
	if (!await player.giveItem(item)) {
		throw Error("Aucun emplacement libre dans l'inventaire");
	}
	return `Vous avez reçu ${item.id} !`;
};

commandInfo.execute = giveItemTestCommand;
