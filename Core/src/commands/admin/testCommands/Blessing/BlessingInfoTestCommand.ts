import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { BlessingManager } from "../../../../core/blessings/BlessingManager";
import { BlessingType } from "../../../../../../Lib/src/constants/BlessingConstants";
import { millisecondsToHours } from "../../../../../../Lib/src/utils/TimeUtils";

export const commandInfo: ITestCommand = {
	name: "blessinginfo",
	aliases: ["bi"],
	description: "Affiche l'état complet du système de bénédiction"
};

const blessingInfoTestCommand: ExecuteTestCommandLike = () => {
	const blessingManager = BlessingManager.getInstance();
	const activeType = blessingManager.getActiveBlessingType();
	const endAt = blessingManager.getBlessingEndAt();

	let info = "**État du système de bénédiction :**\n\n";

	if (blessingManager.hasActiveBlessing()) {
		const remainingMs = endAt!.getTime() - Date.now();
		const remainingHours = Math.round(millisecondsToHours(remainingMs) * 10) / 10;
		info += `✨ **Bénédiction active** : ${BlessingType[activeType]} (type ${activeType})\n`;
		info += `⏳ Temps restant : ${remainingHours}h\n`;
		info += `📅 Fin : ${endAt!.toISOString()}\n`;
	}
	else {
		info += "❌ Aucune bénédiction active\n";
	}

	info += `\n💰 Cagnotte : ${blessingManager.getPoolAmount()} / ${blessingManager.getPoolThreshold()}\n`;
	info += `🙏 Dernier déclencheur : ${blessingManager.getLastTriggeredByKeycloakId() ?? "Personne"}`;

	return info;
};

commandInfo.execute = blessingInfoTestCommand;
