import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { Guilds } from "../../core/database/game/models/Guild";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	CommandGuildContributeNotEnoughMoneyPacket,
	CommandGuildContributePacketReq,
	CommandGuildContributeSuccessPacket,
	CommandGuildContributeTooLowPacket
} from "../../../../Lib/src/packets/commands/CommandGuildContributePacket";

export default class GuildContributeCommand {
	@commandRequires(CommandGuildContributePacketReq, {
		notBlocked: true,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		guildNeeded: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD
	}) async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildContributePacketReq, _context: PacketContext): Promise<void> {
		const amount = packet.amount;

		if (amount < GuildDomainConstants.MIN_CONTRIBUTE_AMOUNT) {
			response.push(makePacket(CommandGuildContributeTooLowPacket, {
				minAmount: GuildDomainConstants.MIN_CONTRIBUTE_AMOUNT
			}));
			return;
		}

		if (player.money < amount) {
			response.push(makePacket(CommandGuildContributeNotEnoughMoneyPacket, {}));
			return;
		}

		const guild = (await Guilds.getById(player.guildId))!;

		await player.addMoney({
			amount: -amount,
			response,
			reason: NumberChangeReason.GUILD_CONTRIBUTE
		});
		await player.save();

		guild.treasury += amount;
		await guild.save();

		response.push(makePacket(CommandGuildContributeSuccessPacket, {
			amount,
			newTreasury: guild.treasury
		}));
	}
}
