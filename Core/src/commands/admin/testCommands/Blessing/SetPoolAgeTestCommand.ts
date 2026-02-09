import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { BlessingManager } from "../../../../core/blessings/BlessingManager";
import {
	hoursToMilliseconds, millisecondsToHours
} from "../../../../../../Lib/src/utils/TimeUtils";

export const commandInfo: ITestCommand = {
	name: "setpoolage",
	aliases: ["spa"],
	commandFormat: "<hours>",
	typeWaited: { hours: TypeKey.STRING },
	minArgs: 1,
	description: "Recule la date de début de la cagnotte de X heures (ex: 84 pour 3j12h)"
};

const setPoolAgeTestCommand: ExecuteTestCommandLike = async (_player, args) => {
	const hours = parseFloat(args[0]);
	if (isNaN(hours)) {
		throw new Error("Veuillez entrer un nombre valide d'heures (ex: 84 pour 3 jours et 12h).");
	}
	if (hours <= 0) {
		throw new Error("Le nombre d'heures doit être supérieur à 0.");
	}

	const blessingManager = BlessingManager.getInstance();
	const newStartDate = new Date(Date.now() - hoursToMilliseconds(hours));
	await blessingManager.forceSetPoolStartedAt(newStartDate);

	const actualAgeHours = Math.round(millisecondsToHours(Date.now() - newStartDate.getTime()) * 100) / 100;

	return `Date de début de la cagnotte reculée de ${hours}h.\nNouvelle date : ${newStartDate.toISOString()}\nÂge effectif : ${actualAgeHours}h\nCagnotte : ${blessingManager.getPoolAmount()} / ${blessingManager.getPoolThreshold()}`;
};

commandInfo.execute = setPoolAgeTestCommand;
