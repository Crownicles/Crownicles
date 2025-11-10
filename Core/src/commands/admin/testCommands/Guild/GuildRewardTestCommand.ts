import Guild from "../../../../core/database/game/models/Guild";
import { GuildDailyConstants } from "../../../../../../Lib/src/constants/GuildDailyConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { CommandGuildDailyPacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import { makePacket } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import GuildDailyCommand from "../../../guild/GuildDailyCommand";

let stringDesc = "Permet de déclencher une récompense de guilde sans passer par les vérifications du cooldown. Liste des sorties disponibles : ";
Object.entries(GuildDailyConstants.REWARD_TYPES)
	.forEach(v => {
		stringDesc += `\n - ${v[1]}`;
	});

export const commandInfo: ITestCommand = {
	name: "guildreward",
	aliases: ["greward"],
	commandFormat: "<reward>",
	typeWaited: { reward: TypeKey.STRING },
	description: stringDesc
};

/**
 * Force a gd with a given out
 */
const guildRewardTestCommand: ExecuteTestCommandLike = async (player, args, response, context) => {
	const guild = await Guild.findOne({ where: { id: player.guildId } });
	if (!guild) {
		throw new Error("Erreur greward : vous n'êtes pas dans une guilde !");
	}

	const rewardValues = Object.values(GuildDailyConstants.REWARD_TYPES);
	if (!rewardValues.includes(args[0])) {
		throw new Error("Erreur greward : reward donné n'existe pas. Veuillez vous référer à la commande \"test help greward\" pour plus d'informations");
	}

	await GuildDailyCommand.execute(response, player, makePacket(CommandGuildDailyPacketReq, {}), context, args[0]);
	return `Reward ${args[0]} forcé !`;
};

commandInfo.execute = guildRewardTestCommand;
