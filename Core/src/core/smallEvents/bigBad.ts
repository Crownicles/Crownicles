import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../maps/TravelTime";
import { MissionsController } from "../missions/MissionsController";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventBigBadPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBigBadPacket";
import { Maps } from "../maps/Maps";
import { Effect } from "../../../../Lib/src/types/Effect";
import { SmallEventBigBadKind } from "../../../../Lib/src/types/SmallEventBigBadKind";

type BigBadProperties = {
	alterationStories: {
		[key: string]: {
			alte: string;
			tags?: string[];
		};
	};
};

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player): Promise<void> => {
		const outRand: SmallEventBigBadKind = RandomUtils.crowniclesRandom.integer(0, 2);
		let lifeLoss, seFallen, moneyLoss, effect;
		const bigBadProperties = SmallEventDataController.instance.getById("bigBad").getProperties<BigBadProperties>();
		switch (outRand) {
			case SmallEventBigBadKind.LIFE_LOSS:
				lifeLoss = RandomUtils.rangedInt(SmallEventConstants.BIG_BAD.HEALTH);
				await player.addHealth(-lifeLoss, response, NumberChangeReason.SMALL_EVENT);
				break;
			case SmallEventBigBadKind.ALTERATION:
				seFallen = RandomUtils.crowniclesRandom.pick(Object.keys(bigBadProperties.alterationStories));
				effect = bigBadProperties.alterationStories[seFallen].alte;
				await TravelTime.applyEffect(player, Effect.getById(effect), 0, new Date(), NumberChangeReason.SMALL_EVENT);
				if (bigBadProperties.alterationStories[seFallen].tags) {
					for (const tag of bigBadProperties.alterationStories[seFallen].tags) {
						await MissionsController.update(player, response, {
							missionId: tag,
							params: { tags: bigBadProperties.alterationStories[seFallen].tags }
						});
					}
				}
				break;
			default:
				moneyLoss = RandomUtils.rangedInt(SmallEventConstants.BIG_BAD.MONEY);
				await player.addMoney({
					amount: -moneyLoss,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});
				break;
		}
		response.push(makePacket(SmallEventBigBadPacket, {
			kind: outRand,
			lifeLost: lifeLoss,
			receivedStory: seFallen,
			moneyLost: moneyLoss,
			effectId: effect
		}));
		await player.save();
	}
};
