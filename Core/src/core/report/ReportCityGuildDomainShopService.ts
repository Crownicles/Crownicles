import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGuildDomainBuyXpErrorRes,
	CommandReportGuildDomainBuyXpReq,
	CommandReportGuildDomainBuyXpRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import {
	Players
} from "../database/game/models/Player";
import {
	Guilds
} from "../database/game/models/Guild";
import { GuildUtils } from "../utils/GuildUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { LockManager } from "../../../../Lib/src/locks/LockManager";

const XP_TIERS: Record<string, number> = {
	small: GuildDomainConstants.SHOP_PRICES.SMALL_XP,
	big: GuildDomainConstants.SHOP_PRICES.BIG_XP
};

const guildXpLockManager = new LockManager();

export async function handleGuildDomainBuyXp(keycloakId: string, packet: CommandReportGuildDomainBuyXpReq): Promise<CrowniclesPacket> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player || !player.guildId) {
		return makePacket(CommandReportGuildDomainBuyXpErrorRes, { error: "noGuild" });
	}

	const price = XP_TIERS[packet.tier];
	if (price === undefined) {
		return makePacket(CommandReportGuildDomainBuyXpErrorRes, { error: "invalidTier" });
	}

	if (player.money < price) {
		return makePacket(CommandReportGuildDomainBuyXpErrorRes, { error: "notEnoughMoney" });
	}

	const lock = guildXpLockManager.getLock(player.guildId);
	const release = await lock.acquire();
	try {
		const guild = await Guilds.getById(player.guildId);
		if (!guild || guild.shopLevel < 1) {
			return makePacket(CommandReportGuildDomainBuyXpErrorRes, { error: "noShop" });
		}

		if (guild.isAtMaxLevel()) {
			return makePacket(CommandReportGuildDomainBuyXpErrorRes, { error: "maxLevel" });
		}

		await player.spendMoney({
			amount: price, response: [], reason: NumberChangeReason.SHOP
		});
		await player.save();

		const xpToAdd = GuildUtils.calculateAmountOfXPToAdd(price);
		await guild.addExperience({
			amount: xpToAdd, response: [], reason: NumberChangeReason.SHOP
		});
		await guild.save();

		return makePacket(CommandReportGuildDomainBuyXpRes, {
			xp: xpToAdd,
			newPlayerMoney: player.money
		});
	}
	finally {
		release();
	}
}
