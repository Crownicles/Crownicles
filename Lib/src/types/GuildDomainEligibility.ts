import { GuildBuilding } from "../constants/GuildDomainConstants";

/**
 * Eligibility flags for upgrading a single guild building.
 * `null` means the building is already at max level.
 * `canAfford` = treasury covers the upgrade cost.
 * `meetsLevel` = guild level satisfies the required level.
 */
export type BuildingUpgradeEligibility = {
	canAfford: boolean;
	meetsLevel: boolean;
};

/** Per-building upgrade eligibility computed by Core. */
export type BuildingUpgradeEligibilityMap = Record<GuildBuilding, BuildingUpgradeEligibility | null>;

/** Whether the player can afford each treasury deposit tier. */
export type DepositTierAffordability = {
	small: boolean;
	big: boolean;
	huge: boolean;
};
