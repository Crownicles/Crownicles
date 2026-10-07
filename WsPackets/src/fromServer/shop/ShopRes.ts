import { FromServerPacket } from "../FromServerPacket";
import { PetSex } from "../../objects/OwnedPet";
import { Mission } from "../../objects/Mission";

/** Told as a word rather than a number, so a reordered enum can never silently change a forecast. */
export const MARKET_TRENDS = {
	NON_APPLICABLE: "nonApplicable",
	BIG_DROP: "bigDrop",
	DROP: "drop",
	STABLE: "stable",
	RISE: "rise",
	BIG_RISE: "bigRise"
} as const;

export type MarketTrendKind = typeof MARKET_TRENDS[keyof typeof MARKET_TRENDS];

export type PlantForecast = {
	plantId: number;
	trends: MarketTrendKind[];
};

/** Everything a commerce can answer once the player has picked something. */
export type ShopOutcome =
	| {
		kind: "purchase";
		shopItemId: string;
		amount: number;
		materials?: Record<string, number>;
		translationParams?: Record<string, string>;
	}
	| {
		kind: "notEnoughCurrency"; missingCurrency: number; currency: string;
	}
	| {
		kind: "money"; amount: number;
	}
	| {
		kind: "kingsFavor"; thousandPoints: number;
	}
	| {
		kind: "missionSkipped"; oldMission: Mission; newMission: Mission;
	}
	| {
		kind: "marketAnalysis";
		kingsMoneyTrends: MarketTrendKind[];
		plantTrends: PlantForecast[];
		plantRotation?: {
			daysUntilRotation: number;
			newPlantIds: number[];
			newPlantForecasts: PlantForecast[];
		};
	}
	| {
		kind: "badge"; badgeId: string;
	}
	| {
		kind: "slotBought"
		| "tooManyDailyPotions"
		| "noPlantSlot"
		| "noGardenForTalisman"
		| "alreadyHasBadge"
		| "alreadyBoughtPointsThisWeek"
		| "noMissionToSkip";
	};

export class ShopOutcomeRes extends FromServerPacket {
	public static readonly wireName = "ShopOutcomeRes";

	public outcome!: ShopOutcome;
}

/** What the veterinarian reveals once the consultation is paid for. */
export class ShopPetCheckupRes extends FromServerPacket {
	public static readonly wireName = "ShopPetCheckupRes";

	public typeId!: number;

	/** Rank of the pet among every pet ever tamed, which is how its age is told. */
	public petId!: number;

	public sex!: PetSex;

	public nickname?: string;

	public loveLevel!: number;

	public lovePoints!: number;

	public maxLovePoints!: number;

	public diet!: string;

	public ageCategory!: string;

	public nextFeed!: number;

	public feedDelay!: number;

	public force!: number;

	public speed!: number;

	public fightAssistId!: string;

	public likedExpeditionTypes?: string[];

	public dislikedExpeditionTypes?: string[];

	public randomPetDwarf?: {
		typeId: number;
		sex: PetSex;
		numberOfPetsNotSeen: number;
	};

	/** Only set when the pet was miserable enough for the care to lift its spirits. */
	public lovePointsGained?: number;
}

export class ShopNoPetRes extends FromServerPacket {
	public static readonly wireName = "ShopNoPetRes";
}
