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
	const hasArguments = helpOnCommand.typeWaited && Object.keys(helpOnCommand.typeWaited).length !== 0;
	const argsAmount = hasArguments ? Object.keys(helpOnCommand.typeWaited).length : 0;
	const hasAliases = helpOnCommand.aliases && helpOnCommand.aliases.length !== 0;
	return `**Commande test : ${helpOnCommand.name}**
${helpOnCommand.description}
**Utilisation :** \`test ${helpOnCommand.name}${helpOnCommand.commandFormat === "" ? "" : ` ${helpOnCommand.commandFormat}`}\`
${hasArguments ? `**Argument${argsAmount === 1 ? "" : "s"} attendu${argsAmount === 1 ? "" : "s"} :**` : ""}
${hasArguments
	? Object.keys(helpOnCommand.typeWaited)
		.map(arg => `- \`<${arg}>\` : ${formatTypeWaited(helpOnCommand.typeWaited[arg])}`)
		.join("\n")
	: ""}
${hasAliases ? `**Alias :** \`${helpOnCommand.aliases.join("`, `")}\`` : ""}`;
};

commandInfo.execute = helpTestCommand;
