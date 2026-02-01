import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventBadIssue,
	SmallEventSmallBadPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventSmallBadPacket";

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player): Promise<void> => {
		const packet: SmallEventSmallBadPacket = new SmallEventSmallBadPacket();
		packet.issue = RandomUtils.crowniclesRandom.pick(Object.values(SmallEventBadIssue)) as SmallEventBadIssue;

		switch (packet.issue) {
			case SmallEventBadIssue.HEALTH:
				packet.amount = RandomUtils.rangedInt(SmallEventConstants.SMALL_BAD.HEALTH);

				break;

			case SmallEventBadIssue.MONEY:
				packet.amount = RandomUtils.rangedInt(SmallEventConstants.SMALL_BAD.MONEY);
				break;

			default: {
				packet.amount = RandomUtils.rangedInt(SmallEventConstants.SMALL_BAD.TIME) * 5;
				const effect = RandomUtils.crowniclesRandom.bool(SmallEventConstants.SMALL_BAD.SLEEPING_PROBABILITY)
					? Effect.SLEEPING
					: Effect.OCCUPIED;
				packet.effectId = effect.id;
				break;
			}
		}

		// Push the small event packet before applying effects to ensure correct packet order
		response.push(makePacket(SmallEventSmallBadPacket, packet));

		// Apply the effects after the small event packet is sent
		switch (packet.issue) {
			case SmallEventBadIssue.HEALTH:
				await player.addHealth({
					amount: -packet.amount,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});
				break;

			case SmallEventBadIssue.MONEY:
				await player.addMoney({
					amount: -packet.amount, response, reason: NumberChangeReason.SMALL_EVENT
				});
				break;

			default:
				await TravelTime.applyEffect(player, packet.effectId === Effect.SLEEPING.id ? Effect.SLEEPING : Effect.OCCUPIED, packet.amount, new Date(), NumberChangeReason.SMALL_EVENT);
				break;
		}

		await player.save();
	}
};
