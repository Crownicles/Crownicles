import Player from "../database/game/models/Player";
import { Settings } from "../database/game/models/Setting";
import { PacketUtils } from "../utils/PacketUtils";
import { botConfig } from "../../bootstrap";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReleaseGiftAnnouncementPacket } from "../../../../Lib/src/packets/announcements/ReleaseGiftAnnouncementPacket";
import { MqttTopicUtils } from "../../../../Lib/src/utils/MqttTopicUtils";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { TimeoutFunctionsConstants } from "../../../../Lib/src/constants/TimeoutFunctionsConstants";
import { ReleaseGiftConstants } from "../../../../Lib/src/constants/ReleaseGiftConstants";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { Sequelize } from "sequelize";

export class ReleaseGift {
	/**
	 * Apply the one-time 6.0.0 release gift to all existing players (money + full tokens) and announce it.
	 * Guarded by a setting so it only ever runs once.
	 */
	static async apply(): Promise<void> {
		if (!PacketUtils.isMqttConnected()) {
			CrowniclesLogger.error("MQTT is not connected, can't apply the 6.0.0 release gift. Trying again in 1 minute");
			setTimeout(ReleaseGift.apply, TimeoutFunctionsConstants.MQTT_RETRY_DELAY);
			return;
		}

		if (await Settings.RELEASE_GIFT_600_APPLIED.getValue() !== 0) {
			return;
		}

		CrowniclesLogger.info("Applying the 6.0.0 release gift to all players...");

		await Player.update(
			{
				money: Sequelize.literal(`money + ${ReleaseGiftConstants.MONEY}`),
				tokens: TokensConstants.MAX
			},
			{ where: {} }
		);

		await Settings.RELEASE_GIFT_600_APPLIED.setValue(1);

		PacketUtils.announce(
			makePacket(ReleaseGiftAnnouncementPacket, {}),
			MqttTopicUtils.getDiscordReleaseGiftAnnouncementTopic(botConfig.PREFIX)
		);

		CrowniclesLogger.info("6.0.0 release gift applied to all players!");
	}
}
