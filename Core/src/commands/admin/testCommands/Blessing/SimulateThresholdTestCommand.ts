import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { BlessingManager } from "../../../../core/blessings/BlessingManager";
import { BlessingConstants } from "../../../../../../Lib/src/constants/BlessingConstants";

export const commandInfo: ITestCommand = {
	name: "simulatethreshold",
	aliases: ["st"],
	commandFormat: "<daysToFill>",
	typeWaited: { daysToFill: TypeKey.STRING },
	minArgs: 1,
	description: "Simule le nouveau seuil si la cagnotte était remplie en X jours"
};

const simulateThresholdTestCommand: ExecuteTestCommandLike = (_player, args) => {
	const daysToFill = parseFloat(args[0]);
	if (isNaN(daysToFill)) {
		throw new Error("Veuillez entrer un nombre valide de jours (ex: 1.5).");
	}
	if (daysToFill <= 0) {
		throw new Error("Le nombre de jours doit être supérieur à 0.");
	}

	const blessingManager = BlessingManager.getInstance();
	const currentThreshold = blessingManager.getPoolThreshold();
	const newThreshold = blessingManager.simulateNewThreshold(daysToFill);
	const delta = newThreshold - currentThreshold;
	const sign = delta >= 0 ? "+" : "";

	return `Simulation du changement de seuil :\nSeuil actuel : ${currentThreshold}\nDurée simulée : ${daysToFill}j (cible : ${BlessingConstants.TARGET_FILL_DAYS}j)\nNouveau seuil : ${newThreshold} (${sign}${delta})\nStep max : ±${BlessingConstants.MAX_THRESHOLD_STEP}\nBornes : [${BlessingConstants.MIN_POOL_THRESHOLD}, ${BlessingConstants.MAX_POOL_THRESHOLD}]`;
};

commandInfo.execute = simulateThresholdTestCommand;
