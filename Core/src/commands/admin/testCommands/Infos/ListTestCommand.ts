import {
	CommandsTest, ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "list",
	description: "Affiche la liste complète des commandes de test organisées par catégories avec leurs noms et aliases. Utilisez 'test help <command>' pour plus de détails"
};

/**
 * Print the whole test command list, filtered by category
 */
const listTestCommand: ExecuteTestCommandLike = () => `Voici la liste des commandes tests disponibles :
Si vous voulez plus d'informations sur une commande test en particulier, écrivez ceci : \`test help <command>\`
${CommandsTest.testCommType.map(category => {
	const allTestCommInCate = CommandsTest.getAllCommandsFromCategory(category);
	let stringForThisCategory = "";
	allTestCommInCate.forEach(testCommand => {
		stringForThisCategory += `${testCommand.name} • `;
	});
	return `**${category}**
${stringForThisCategory === "" ? "*Pas de commandes dans cette catégorie*" : stringForThisCategory.slice(0, stringForThisCategory.length - 3)}`;
}).join("\n\n")}`;

commandInfo.execute = listTestCommand;
