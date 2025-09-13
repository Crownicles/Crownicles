import {
	getItemByIdAndCategory, giveItemToPlayer
} from "../../../../core/utils/ItemUtils";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "finditem",
	commandFormat: "<category [0-3]> <item id>",
	typeWaited: {
		"category [0-3]": TypeKey.INTEGER,
		"item id": TypeKey.INTEGER
	},
	description: "Fait découvrir et ajouter un objet spécifique à l'inventaire du joueur. Catégories : 0=armes, 1=armures, 2=potions, 3=objets. Voir Core/resources/[category]/ pour les IDs"
};

/**
 * Set the weapon of the player
 */
const findItemTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
	const category = parseInt(args[0], 10);
	const itemId = parseInt(args[1], 10);
	if (category < 0 || category > 3) {
		throw Error("Catégorie inconnue. Elle doit être en 0 et 3");
	}
	const item = getItemByIdAndCategory(itemId, category);
	if (!item) {
		throw Error("Aucun objet n'existe dans cette catégorie avec cet id");
	}

	await giveItemToPlayer(response, context, player, item);
	return `Vous avez trouvé l'objet d'id ${itemId} de la catégorie n°${category}.`;
};

commandInfo.execute = findItemTestCommand;
