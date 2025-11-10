import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PlayerMissionsInfos } from "../../../../core/database/game/models/PlayerMissionsInfo";
import { Campaign } from "../../../../core/missions/Campaign";

export const commandInfo: ITestCommand = {
	name: "setCampaignBlob",
	aliases: ["scb"],
	commandFormat: "<blob>",
	typeWaited: { blob: TypeKey.INTEGER },
	description: "Modifie le blob de progression de campagne (chaîne binaire). Format requis : séquence de 0 et 1 correspondant chacun a une mission de la campagne, 0 = mission pas encore terminée et 1 = mission validée. Ex: sur une campagne de 5 missions, un joueur qui a terminé les 3 premières aura 11100."
};

const setCampaignBlobTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	const givenBlob = args[0];
	const isGoodBlob = new RegExp(/^[01]+$/).test(givenBlob);
	if (givenBlob.length !== Campaign.getMaxCampaignNumber() || !isGoodBlob) {
		throw Error(`Blob invalide. Il doit être composé uniquement de 0 et de 1 et faire ${
			Campaign.getMaxCampaignNumber()
		} caractères (actuellement ${
			givenBlob.length
		} caractères, uniquement 0/1 : ${
			isGoodBlob
		}))`);
	}
	missionsInfo.campaignBlob = givenBlob;
	await missionsInfo.save();

	return `Vous avez changé votre blob à ${givenBlob}`;
};

commandInfo.execute = setCampaignBlobTestCommand;
