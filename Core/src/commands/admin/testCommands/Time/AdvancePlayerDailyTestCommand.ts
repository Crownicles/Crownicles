import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { InventoryInfos } from "../../../../core/database/game/models/InventoryInfo";

export const commandInfo: ITestCommand = {
	name: "advanceplayerdaily",
	aliases: ["adaily"],
	commandFormat: "<time>",
	typeWaited: { time: TypeKey.INTEGER },
	description: "Avance la date de la dernière récompense quotidienne du joueur de X minutes, permettant de récupérer la récompense quotidienne plus tôt"
};

/**
 * Quick travel your daily of a given time
 */
const advancePlayerDailyTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);
	inventoryInfo.lastDailyAt = new Date(inventoryInfo.lastDailyAt.valueOf() - parseInt(args[0], 10) * 60000);
	await inventoryInfo.save();
	return `Vous avez avancé votre daily de ${args[0]} minutes !`;
};

commandInfo.execute = advancePlayerDailyTestCommand;
