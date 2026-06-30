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
import Player, {
	Players
} from "../database/game/models/Player";
import {
	Guild
} from "../database/game/models/Guild";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { crowniclesInstance } from "../../app";
import type { GuildTreasuryDepositLogParams } from "../database/logs/LogsCityLogger";
import { MissionsController } from "../missions/MissionsController";

interface DepositTreasuryResult {
	packet: CrowniclesPacket;
	logParams: GuildTreasuryDepositLogParams | null;
}

function logGuildTreasuryDeposit(params: GuildTreasuryDepositLogParams | null): void {
	if (params === null) {
		return;
	}
	crowniclesInstance?.logsDatabase.logGuildTreasuryDeposit(params).then();
}

/**
 * Both `player.money` and `guild.treasury` are mutated in this critical
 * section, so we hold a row lock on BOTH rows for the whole
 * read-validate-mutate-save sequence. `withLockedEntities` orders keys to
 * avoid deadlocks and propagates the transaction via CLS so nested
 * `.save()` calls on the returned instances enlist automatically.
 */
function runTreasuryDepositUnderLock(
	keycloakId: string,
	packet: CommandReportGuildDomainDepositTreasuryReq,
	guildId: number,
	playerId: number,
	grossAmount: number
): Promise<DepositTreasuryResult> {
	return withLockedEntities(
		[Guild.lockKey(guildId), Player.lockKey(playerId)] as const,
		async ([lockedGuild, lockedPlayer]) => {
			/*
			 * Re-validate against the locked rows. Another concurrent
			 * handler (a parallel deposit, a shop purchase, …) may have
			 * drained the player's wallet between our fast-fail above and
			 * the lock acquisition.
			 */
			if (lockedPlayer.money < grossAmount) {
				return {
					packet: makePacket(CommandReportGuildDomainDepositTreasuryErrorRes, { error: GUILD_DOMAIN_ERROR.NOT_ENOUGH_MONEY }),
					logParams: null
				};
			}

			const penalty = packet.isReimburse ? 0 : GuildDomainConstants.computeTreasuryPenalty(grossAmount);
			const treasuryDeposited = grossAmount - penalty;
			lockedGuild.treasury += treasuryDeposited;
			await lockedGuild.save();

			await lockedPlayer.spendMoney({
				amount: grossAmount, response: [], reason: NumberChangeReason.SHOP
			});
			await lockedPlayer.save();

			return {
				packet: makePacket(CommandReportGuildDomainDepositTreasuryRes, {
					treasuryDeposited,
					newPlayerMoney: lockedPlayer.money,
					newTreasury: lockedGuild.treasury
				}),
				logParams: {
					keycloakId,
					guild: lockedGuild,
					grossAmount,
					treasuryDeposited,
					penalty,
					isReimburse: packet.isReimburse ?? false
				}
			};
		}
	);
}

export async function handleGuildDomainDepositTreasury(keycloakId: string, packet: CommandReportGuildDomainDepositTreasuryReq, response: CrowniclesPacket[]): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player || !player.guildId) {
		return makePacket(CommandReportGuildDomainDepositTreasuryErrorRes, { error: GUILD_DOMAIN_ERROR.NO_GUILD });
	}

	const grossAmount = Math.floor(packet.amount);
	if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
		return makePacket(CommandReportGuildDomainDepositTreasuryErrorRes, { error: GUILD_DOMAIN_ERROR.INVALID_AMOUNT });
	}

	/*
	 * Fast-fail outside the lock so we don't pay for a transaction round
	 * trip when the player obviously can't afford the deposit. The check
	 * is repeated *inside* the lock against a freshly-loaded row.
	 */
	if (player.money < grossAmount) {
		return makePacket(CommandReportGuildDomainDepositTreasuryErrorRes, { error: GUILD_DOMAIN_ERROR.NOT_ENOUGH_MONEY });
	}

	const result = await runTreasuryDepositUnderLock(keycloakId, packet, player.guildId, player.id, grossAmount);

	logGuildTreasuryDeposit(result.logParams);
	if (result.logParams !== null) {
		await MissionsController.update(player, response, { missionId: "depositGuildTreasury" });
	}
	return result.packet;
}
