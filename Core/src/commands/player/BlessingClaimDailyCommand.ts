import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { CommandBlessingClaimDailyPacketReq } from "../../../../Lib/src/packets/commands/CommandBlessingClaimDailyPacketReq";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import { CommandBlessingClaimDailyPacketRes } from "../../../../Lib/src/packets/commands/CommandBlessingClaimDailyPacketRes";
import { BlessingManager } from "../../core/blessings/BlessingManager";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import {
	DailyMissions
} from "../../core/database/game/models/DailyMission";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";

export default class BlessingClaimDailyCommand {
	@commandRequires(CommandBlessingClaimDailyPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandBlessingClaimDailyPacketReq): Promise<void> {
		const blessingManager = BlessingManager.getInstance();

		// Verify the player can still claim
		if (!blessingManager.canPlayerClaimDailyBonus(player.keycloakId)) {
			response.push(makePacket(CommandBlessingClaimDailyPacketRes, {
				success: false,
				gemsWon: 0,
				xpWon: 0,
				moneyWon: 0,
				pointsWon: 0
			}));
			return;
		}

		const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		if (!missionInfo.hasCompletedDailyMission()) {
			response.push(makePacket(CommandBlessingClaimDailyPacketRes, {
				success: false,
				gemsWon: 0,
				xpWon: 0,
				moneyWon: 0,
				pointsWon: 0
			}));
			return;
		}

		// Calculate the bonus (same as the original rewards, effectively doubling)
		const dailyMission = await DailyMissions.getOrGenerate();
		const gemsWon = dailyMission.gemsToWin;
		const xpWon = dailyMission.xpToWin;
		const moneyWon = Math.round(dailyMission.moneyToWin * Constants.MISSIONS.DAILY_MISSION_MONEY_MULTIPLIER);
		const pointsWon = Math.round(dailyMission.pointsToWin * Constants.MISSIONS.DAILY_MISSION_POINTS_MULTIPLIER);

		// Give the bonus rewards
		await missionInfo.addGems(gemsWon, player.keycloakId, NumberChangeReason.BLESSING);
		player = await player.addExperience({
			amount: xpWon,
			response,
			reason: NumberChangeReason.BLESSING
		});
		player = await player.addMoney({
			amount: moneyWon,
			response,
			reason: NumberChangeReason.BLESSING
		});
		await player.addScore({
			amount: pointsWon,
			response,
			reason: NumberChangeReason.BLESSING
		});

		// Mark as claimed
		blessingManager.markDailyBonusClaimed(player.keycloakId);

		response.push(makePacket(CommandBlessingClaimDailyPacketRes, {
			success: true,
			gemsWon,
			xpWon,
			moneyWon,
			pointsWon
		}));
	}
}
