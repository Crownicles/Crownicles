import {CommandInteraction} from "discord.js";
import {ITestCommand} from "../../../../core/CommandsTest";
import {Players} from "../../../../core/database/game/models/Player";
import {FightController} from "../../../../core/fights/FightController";
import {Classes} from "../../../../core/database/game/models/Class";
import {Constants} from "../../../../core/Constants";
import {PlayerFighter} from "../../../../core/fights/fighter/PlayerFighter";
import {FightStatModifierOperation} from "../../../../core/fights/fighter/Fighter";
import {FightOvertimeBehavior} from "../../../../core/fights/FightOvertimeBehavior";

export const commandInfo: ITestCommand = {
	name: "solofight",
	commandFormat: "<instant>",
	typeWaited: {
		instant: Constants.TEST_VAR_TYPES.INTEGER
	},
	messageWhenExecuted: "",
	description: "Faire un combat contre soi-même",
	commandTestShouldReply: false,
	execute: null // Defined later
};

/**
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @param args
 * @return {String} - The successful message formatted
 */
const soloFightTestCommand = async (language: string, interaction: CommandInteraction, args: string[]): Promise<string> => {
	const [player] = await Players.getOrRegister(interaction.user.id);
	const playerClass = await Classes.getById(player.class);
	const fighter1 = new PlayerFighter(interaction.user, player, playerClass);
	await fighter1.loadStats(false);
	const fighter2 = new PlayerFighter(interaction.user, player, playerClass);
	await fighter2.loadStats(false);

	if (args[0] === "1") {
		fighter1.applyAttackModifier({
			operation: FightStatModifierOperation.ADDITION,
			origin: null,
			value: 9999
		});
		fighter1.applyDefenseModifier({
			operation: FightStatModifierOperation.MULTIPLIER,
			origin: null,
			value: 0.01
		});
		fighter2.applyAttackModifier({
			operation: FightStatModifierOperation.ADDITION,
			origin: null,
			value: 9999
		});
		fighter2.applyDefenseModifier({
			operation: FightStatModifierOperation.MULTIPLIER,
			origin: null,
			value: 0.01
		});
	}

	new FightController({ fighter1, fighter2 }, { friendly: false, overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW }, interaction.channel, language)
		.startFight()
		.then();

	return null;
};

commandInfo.execute = soloFightTestCommand;