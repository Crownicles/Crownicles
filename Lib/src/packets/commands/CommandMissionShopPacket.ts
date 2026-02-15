import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { BaseMission } from "../../types/CompletedMission";
import { PetDiet } from "../../constants/PetConstants";
import { SexTypeShort } from "../../constants/StringConstants";
import { PlantId } from "../../constants/PlantConstants";

/**
 * Market trend indicator for the market analysis shop item.
 * Describes price evolution relative to the current day.
 */
export enum MarketTrend {
	BIG_DROP = -2,
	DROP = -1,
	STABLE = 0,
	RISE = 1,
	BIG_RISE = 2
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandMissionShopPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopAlreadyBoughtPointsThisWeek extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopMoney extends CrowniclesPacket {
	amount!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopKingsFavor extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopPetInformation extends CrowniclesPacket {
	nickname!: string;

	petId!: number;

	typeId!: number;

	sex!: SexTypeShort;

	loveLevel!: number;

	lovePoints!: number;

	diet!: PetDiet;

	nextFeed!: number;

	fightAssistId!: string;

	ageCategory!: string;

	force!: number;

	speed!: number;

	feedDelay!: number;

	/**
	 * Expedition location types that this pet likes (e.g., "forest", "mountain")
	 */
	likedExpeditionTypes?: string[];

	/**
	 * Expedition location types that this pet dislikes (e.g., "desert", "swamp")
	 */
	dislikedExpeditionTypes?: string[];

	randomPetDwarf?: {
		typeId: number;
		sex: SexTypeShort;
		numberOfPetsNotSeen: number;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopSkipMissionResult extends CrowniclesPacket {
	oldMission!: BaseMission;

	newMission!: BaseMission;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopBadge extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopNoMissionToSkip extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopAlreadyHadBadge extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopNoPet extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMissionShopMarketAnalysis extends CrowniclesPacket {
	/**
	 * King's money trends: [tomorrow, 3 days, 7 days]
	 */
	kingsMoneyTrends!: [MarketTrend, MarketTrend, MarketTrend];

	/**
	 * Plant price trends for each weekly plant.
	 * Trends are null for horizons where the plant is no longer available due to weekly rotation.
	 */
	plantTrends!: {
		plantId: PlantId;
		trends: [MarketTrend | null, MarketTrend | null, MarketTrend | null];
	}[];

	/**
	 * Info about plant rotation at a future horizon.
	 * Only set if the weekly plant selection changes within the forecast period.
	 * horizonIndex: 0 = tomorrow, 1 = 3 days, 2 = 7 days
	 */
	plantRotation?: {
		horizonIndex: number;
		newPlantIds: PlantId[];

		/**
		 * Forecasts for the new plants at post-rotation horizons.
		 * Trends describe whether prices will be above (RISE/BIG_RISE) or below (DROP/BIG_DROP) average.
		 */
		newPlantForecasts: {
			plantId: PlantId;
			trends: (MarketTrend | null)[];
		}[];
	};
}
