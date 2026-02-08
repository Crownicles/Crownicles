import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { BlessingManager } from "../../../../core/blessings/BlessingManager";

export const commandInfo: ITestCommand = {
	name: "resetblessing",
	aliases: ["rb"],
	description: "Expire immédiatement la bénédiction active et remet la pool à zéro"
};

const resetBlessingTestCommand: ExecuteTestCommandLike = async () => {
	const blessingManager = BlessingManager.getInstance();
	await blessingManager.forceReset();

	return "Bénédiction expirée et pool réinitialisée.";
};

commandInfo.execute = resetBlessingTestCommand;
