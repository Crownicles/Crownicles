import { MissionsController } from "../../../../core/missions/MissionsController";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { MissionSlots } from "../../../../core/database/game/models/MissionSlot";
import { PlayerMissionsInfos } from "../../../../core/database/game/models/PlayerMissionsInfo";
import { CampaignData } from "../../../../data/Campaign";

export const commandInfo: ITestCommand = {
	name: "setCampaign",
	commandFormat: "<progression>",
	typeWaited: {
		progression: TypeKey.INTEGER
	},
	description: "Positionne le joueur à une étape spécifique de la campagne principale. Utile pour tester des missions de campagne avancées sans refaire tout le scénario",
	argSuggestions: { progression: ["1", "5", "10", "15", "20", "25", "30"] }
};

const setCampaignTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const missionSlots = await MissionSlots.getOfPlayer(player.id);
	const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	const progression = parseInt(args[0], 10);
	const [campaign] = missionSlots.filter(m => m.isCampaign());
	const campaignMission = CampaignData.getMissions()[progression - 1];

	missionsInfo.campaignProgression = progression;
	missionsInfo.campaignBlob = `${"1".repeat(progression - 1)}0${missionsInfo.campaignBlob.slice(progression)}`;
	campaign.missionId = campaignMission.missionId;
	campaign.missionObjective = campaignMission.missionObjective;
	campaign.missionVariant = campaignMission.missionVariant;
	campaign.numberDone = await MissionsController.getMissionInterface(campaign.missionId).initialNumberDone(player, campaign.missionVariant) as number;
	campaign.xpToWin = campaignMission.xpToWin;
	campaign.gemsToWin = campaignMission.gemsToWin;
	campaign.moneyToWin = campaignMission.moneyToWin;
	campaign.saveBlob = null;
	await campaign.save();
	await missionsInfo.save();

	return `Vous êtes maintenant à l'étape ${progression} de la campagne`;
};

commandInfo.execute = setCampaignTestCommand;
