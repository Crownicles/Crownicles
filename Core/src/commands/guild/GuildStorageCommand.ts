import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandGuildStoragePacketReq, CommandGuildStoragePacketRes, FoodStorage
} from "../../../../Lib/src/packets/commands/CommandGuildStoragePacket";
import { Guilds } from "../../core/database/game/models/Guild";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";

export default class GuildStorageCommand {
	@commandRequires(CommandGuildStoragePacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		guildNeeded: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD
	}) async execute(response: CrowniclesPacket[], player: Player): Promise<void> {
		const guild = (await Guilds.getById(player.guildId))!;
		const foods: FoodStorage[] = [];
		for (const foodKey of Object.values(PetConstants.PET_FOOD)) {
			foods.push({
				id: foodKey,
				amount: guild[foodKey as keyof Guilds],
				maxAmount: GuildConstants.MAX_PET_FOOD[Object.values(PetConstants.PET_FOOD)
					.indexOf(foodKey)]
			});
		}
		response.push(makePacket(CommandGuildStoragePacketRes, {
			guildName: guild.name,
			foods
		}));
	}
}
