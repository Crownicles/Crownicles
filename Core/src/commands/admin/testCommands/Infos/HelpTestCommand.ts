import {
	CommandsTest,
	ExecuteTestCommandLike,
	formatTypeWaited,
	ITestCommand,
	TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "help",
	aliases: ["h"],
	commandFormat: "<command>",
	typeWaited: { command: TypeKey.STRING },
	description: "Affiche l'aide détaillée pour une commande de test spécifiée : description, format, paramètres et aliases disponibles"
};

/**
 * Help the player about one given test command
 */
const helpTestCommand: ExecuteTestCommandLike = (_player, args): string => {
	let helpOnCommand: ITestCommand;
	try {
		helpOnCommand = CommandsTest.getTestCommand(args[0]);
	}
	catch {
		throw new Error(`Commande inexistante : ${args[0]}`);
	}
	const typeWaited = helpOnCommand.typeWaited;
	const aliases = helpOnCommand.aliases;
	const hasArguments = typeWaited && Object.keys(typeWaited).length !== 0;
	const argsAmount = hasArguments ? Object.keys(typeWaited).length : 0;
	const hasAliases = aliases && aliases.length !== 0;
	return `**Commande test : ${helpOnCommand.name}**
${helpOnCommand.description}
**Utilisation :** \`test ${helpOnCommand.name}${helpOnCommand.commandFormat === "" ? "" : ` ${helpOnCommand.commandFormat}`}\`
${hasArguments ? `**Argument${argsAmount === 1 ? "" : "s"} attendu${argsAmount === 1 ? "" : "s"} :**` : ""}
${hasArguments && typeWaited
	? Object.keys(typeWaited)
		.map(arg => `- \`<${arg}>\` : ${formatTypeWaited(typeWaited[arg])}`)
		.join("\n")
	: ""}
${hasAliases && aliases ? `**Alias :** \`${aliases.join("`, `")}\`` : ""}`;
};

commandInfo.execute = helpTestCommand;
