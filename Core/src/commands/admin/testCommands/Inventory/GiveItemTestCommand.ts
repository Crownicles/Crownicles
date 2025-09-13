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
	description: "Donne un objet spécifique au joueur. Catégories : 0=armes, 1=armures, 2=potions, 3=objets. Voir Core/resources/[category]/ pour les IDs"
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
