import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { PlayerMissionsInfos } from "../../../../core/database/game/models/PlayerMissionsInfo";
import { Campaign } from "../../../../core/missions/Campaign";

export const commandInfo: ITestCommand = {
	name: "setCampaignBlob",
	aliases: ["scb"],
	commandFormat: "<blob>",
	typeWaited: {
		blob: TypeKey.INTEGER
	},
	description: "Modifie le blob de progression de campagne (chaîne binaire). Format requis : séquence de 0 et 1 correspondant au nombre max de campagnes"
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
