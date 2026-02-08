import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { BlessingManager } from "../../../../core/blessings/BlessingManager";

export const commandInfo: ITestCommand = {
	name: "setpoolthreshold",
	aliases: ["spt"],
	commandFormat: "<amount>",
	typeWaited: { amount: TypeKey.INTEGER },
	description: "Définit le seuil de la cagnotte de bénédiction"
};

const setPoolThresholdTestCommand: ExecuteTestCommandLike = async (_player, args) => {
	const amount = parseInt(args[0], 10);
	if (amount < 1) {
		throw new Error("Le seuil doit être supérieur à 0.");
	}

	const blessingManager = BlessingManager.getInstance();
	await blessingManager.forceSetThreshold(amount);

	return `Seuil défini à ${amount}. Cagnotte actuelle : ${blessingManager.getPoolAmount()}.`;
};

commandInfo.execute = setPoolThresholdTestCommand;
