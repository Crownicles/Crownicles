import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { BlessingManager } from "../../../../core/blessings/BlessingManager";

export const commandInfo: ITestCommand = {
	name: "contribute",
	aliases: ["cont"],
	commandFormat: "<amount>",
	typeWaited: { amount: TypeKey.INTEGER },
	description: "Contribue à la cagnotte sans dépenser d'argent (pour tester le déclenchement)"
};

const contributeTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const amount = parseInt(args[0], 10);
	if (amount < 1) {
		throw new Error("Le montant doit être supérieur à 0.");
	}

	const blessingManager = BlessingManager.getInstance();
	const triggered = await blessingManager.contribute(amount, player.keycloakId);

	if (triggered) {
		return `Contribution de ${amount} ajoutée. La cagnotte est pleine ! Bénédiction déclenchée : ${blessingManager.getActiveBlessingType()}`;
	}
	return `Contribution de ${amount} ajoutée. Cagnotte : ${blessingManager.getPoolAmount()} / ${blessingManager.getPoolThreshold()}.`;
};

commandInfo.execute = contributeTestCommand;
