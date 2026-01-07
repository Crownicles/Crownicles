import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { WitchActionDataController } from "../../../../data/WitchAction";
import { smallEventFuncs } from "../../../../core/smallEvents/witch";

const witchActions = WitchActionDataController.instance.getAll();

const strings: string[] = [];
const actionIds: string[] = [];
witchActions
	.forEach(action => {
		strings.push(`- ${action.id}`);
		actionIds.push(action.id);
	});

export const commandInfo: ITestCommand = {
	name: "witch",
	commandFormat: "<action1> <action2> <action3>",
	typeWaited: {
		action1: TypeKey.STRING,
		action2: TypeKey.STRING,
		action3: TypeKey.STRING
	},
	description: `Force le déclenchement du mini-événement de la sorcière avec 3 actions spécifiées. Permet de tester les différents choix et leurs conséquences. Liste des actions :\n${strings.join("\n")}`,
	argSuggestions: {
		action1: actionIds,
		action2: actionIds,
		action3: actionIds
	}
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

	await smallEventFuncs.executeSmallEvent(response, player, context, args);
	return "Mini event forcé !";
};

commandInfo.execute = smallEventTestCommand;
