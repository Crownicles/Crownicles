import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { BlessingManager } from "../../../../core/blessings/BlessingManager";

export const commandInfo: ITestCommand = {
	name: "setpool",
	aliases: ["sp"],
	commandFormat: "<amount>",
	typeWaited: { amount: TypeKey.INTEGER },
	description: "Définit le montant actuel de la cagnotte de bénédiction"
};

const setPoolTestCommand: ExecuteTestCommandLike = async (_player, args) => {
	const amount = parseInt(args[0], 10);
	if (amount < 0) {
		throw new Error("Le montant ne peut pas être négatif.");
	}

	const blessingManager = BlessingManager.getInstance();
	await blessingManager.forceSetPool(amount);

	return `Cagnotte définie à ${amount}. Seuil actuel : ${blessingManager.getPoolThreshold()}.`;
};

commandInfo.execute = setPoolTestCommand;
