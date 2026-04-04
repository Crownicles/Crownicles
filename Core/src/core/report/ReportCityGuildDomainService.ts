import { Player } from "../database/game/models/Player";
import { City } from "../../data/City";
import { Guilds } from "../database/game/models/Guild";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGuildDomainNotEnoughTreasuryRes,
	CommandReportGuildDomainPurchaseRes,
	CommandReportGuildDomainRelocateRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

export async function handleGuildDomainNotaryReaction(player: Player, city: City, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
	if (!guild || guild.chiefId !== player.id) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to use guild domain notary but is not guild chief.`);
		return;
	}

	const isRelocation = guild.domainCityId !== null;
	const cost = isRelocation
		? GuildDomainConstants.DOMAIN_RELOCATION_COST
		: GuildDomainConstants.DOMAIN_PURCHASE_COST;

	if (guild.treasury < cost) {
		response.push(makePacket(CommandReportGuildDomainNotEnoughTreasuryRes, {
			missingTreasury: cost - guild.treasury
		}));
		return;
	}

	guild.treasury -= cost;
	guild.domainCityId = city.id;
	await guild.save();

	if (isRelocation) {
		response.push(makePacket(CommandReportGuildDomainRelocateRes, { cost }));
	}
	else {
		response.push(makePacket(CommandReportGuildDomainPurchaseRes, { cost }));
	}
}
