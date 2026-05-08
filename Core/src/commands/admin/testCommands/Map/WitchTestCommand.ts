import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { WitchActionDataController } from "../../../../data/WitchAction";
import { smallEventFuncs } from "../../../../core/smallEvents/witch";
import { InventorySlots } from "../../../../core/database/game/models/InventorySlot";

const witchActions = WitchActionDataController.instance.getAll();

const strings: string[] = [];
witchActions
	.forEach(action => {
		strings.push(`- ${action.id}`);
	});

export const commandInfo: ITestCommand = {
	name: "witch",
	commandFormat: "<action1> <action2> <action3>",
	typeWaited: {
		action1: TypeKey.STRING,
		action2: TypeKey.STRING,
		action3: TypeKey.STRING
	},
	description: `Force le déclenchement du mini-événement de la sorcière avec 3 actions spécifiées. Permet de tester les différents choix et leurs conséquences. Liste des actions :\n${strings.join("\n")}`
};

const witchActionsLower = witchActions.map(action => action.id.toLowerCase());

/**
 * Force a witch small event with the given actions
 */
const smallEventTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
	args.forEach(item => {
		const actionPos = witchActionsLower.indexOf(item.toLowerCase());
		if (actionPos === -1) {
			throw new Error(`Erreur witch : l'action ${item} n'existe pas. Veuillez vous référer à la commande "test help witch" pour plus d'informations`);
		}
	});

	await smallEventFuncs.executeSmallEvent(response, player, context, await InventorySlots.getPlayerActiveObjects(player.id), args);
	return "Mini event forcé !";
};

commandInfo.execute = smallEventTestCommand;
