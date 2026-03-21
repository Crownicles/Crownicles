import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "resetfurnace",
	commandFormat: "",
	typeWaited: {},
	description: "Réinitialise la surchauffe et les utilisations du fourneau"
};

const resetFurnaceTestCommand: ExecuteTestCommandLike = async player => {
	player.furnaceUsesToday = 0;
	player.furnaceOverheatUntil = null;
	await player.save();

	return "Fourneau réinitialisé ! Surchauffe levée et utilisations remises à 0.";
};

commandInfo.execute = resetFurnaceTestCommand;
