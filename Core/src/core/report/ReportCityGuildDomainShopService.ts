import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGuildDomainDepositTreasuryErrorRes,
	CommandReportGuildDomainDepositTreasuryReq,
	CommandReportGuildDomainDepositTreasuryRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	GUILD_DOMAIN_ERROR, GuildDomainConstants
} from "../../../../Lib/src/constants/GuildDomainConstants";
import {
	Players
} from "../database/game/models/Player";
import {
	Guilds
} from "../database/game/models/Guild";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { LockManager } from "../../../../Lib/src/locks/LockManager";

const treasuryDepositLockManager = new LockManager();

export async function handleGuildDomainDepositTreasury(keycloakId: string, packet: CommandReportGuildDomainDepositTreasuryReq): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player || !player.guildId) {
		return makePacket(CommandReportGuildDomainDepositTreasuryErrorRes, { error: GUILD_DOMAIN_ERROR.NO_GUILD });
	}

	const grossAmount = Math.floor(packet.amount);
	if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
		return makePacket(CommandReportGuildDomainDepositTreasuryErrorRes, { error: GUILD_DOMAIN_ERROR.INVALID_TIER });
	}

	if (player.money < grossAmount) {
		return makePacket(CommandReportGuildDomainDepositTreasuryErrorRes, { error: GUILD_DOMAIN_ERROR.NOT_ENOUGH_MONEY });
	}

	const lock = treasuryDepositLockManager.getLock(player.guildId);
	const release = await lock.acquire();
	try {
		const guild = await Guilds.getById(player.guildId);
		if (!guild) {
			return makePacket(CommandReportGuildDomainDepositTreasuryErrorRes, { error: GUILD_DOMAIN_ERROR.NO_GUILD });
		}

		const penalty = packet.isReimburse
			? 0
			: Math.min(
				Math.round(grossAmount * GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.PERCENT),
				GuildDomainConstants.TREASURY_DEPOSIT_PENALTY.MAX
			);
		const treasuryDeposited = grossAmount - penalty;
		guild.treasury += treasuryDeposited;
		await guild.save();

		await player.spendMoney({
			amount: grossAmount, response: [], reason: NumberChangeReason.SHOP
		});
		await player.save();

		return makePacket(CommandReportGuildDomainDepositTreasuryRes, {
			treasuryDeposited,
			newPlayerMoney: player.money,
			newTreasury: guild.treasury
		});
	}
	finally {
		release();
	}
}
