import type {Href} from "expo-router";
import {JOURNEY_LEVELS} from "ws-packets/src/objects/Journey";
import {ONBOARDING_MISSION_IDS, ONBOARDING_TRIALS} from "ws-packets/src/objects/Onboarding";

/** The parts of the game a newcomer discovers one after the other, in that order. */
export const JOURNEY_FEATURES = {
	PROFILE: "profile",
	CLASSES: "classes",
	FIGHTS: "fights",
	GUILD: "guild",
	PET: "pet"
} as const;
export type JourneyFeature = typeof JOURNEY_FEATURES[keyof typeof JOURNEY_FEATURES];

/** The tabs of the app; the adventure is always open. */
export const JOURNEY_TABS = {
	ADVENTURE: "index",
	PROFILE: "profile",
	PET: "pet",
	GUILD: "guild",
	ARENA: "arena"
} as const;
export type JourneyTab = typeof JOURNEY_TABS[keyof typeof JOURNEY_TABS];

export function isJourneyTab(value: unknown): value is JourneyTab {
	return Object.values(JOURNEY_TABS).some(tab => tab === value);
}

/** What the server says of the character's progress, as far as unlocking goes. */
export type JourneyProgress = {
	started: boolean;
	level: number;

	/** The character owns a pet, or already did: freeing it does not close the tab again. */
	metPet: boolean;
	hasGuild: boolean;

	/** The campaign got past the first item, which the profile's inventory is there to equip. */
	inventoryTaught: boolean;
};

/** The mission right after the first item: by then the player holds something to equip. */
const INVENTORY_MISSION_POSITION = ONBOARDING_TRIALS.flatMap(trial => trial.missions).indexOf(ONBOARDING_MISSION_IDS.FIND_OR_BUY_ITEM) + 2;

/** Core sends 0 once the whole campaign is completed. */
const CAMPAIGN_COMPLETED = 0;

export function isInventoryTaught(campaignProgression: number): boolean {
	return campaignProgression === CAMPAIGN_COMPLETED || campaignProgression >= INVENTORY_MISSION_POSITION;
}

export type JourneyStep = {
	feature: JourneyFeature;
	tab: JourneyTab;

	/** Where discovering the feature leads. */
	route: Href;
	icon: string;

	/** The level announced to the player while the feature is still closed, when a level opens it. */
	level?: number;
	isUnlocked: (progress: JourneyProgress) => boolean;
};

export const JOURNEY_STEPS: readonly JourneyStep[] = [
	{feature: JOURNEY_FEATURES.PROFILE, tab: JOURNEY_TABS.PROFILE, route: "/profile", icon: "navigation.profile", isUnlocked: progress => progress.started && progress.inventoryTaught},
	{
		feature: JOURNEY_FEATURES.CLASSES, tab: JOURNEY_TABS.ARENA, route: "/arena/classes", icon: "commands.classes", level: JOURNEY_LEVELS.CLASSES,
		isUnlocked: progress => progress.level >= JOURNEY_LEVELS.CLASSES
	},
	{
		feature: JOURNEY_FEATURES.FIGHTS, tab: JOURNEY_TABS.ARENA, route: "/arena", icon: "navigation.fight", level: JOURNEY_LEVELS.FIGHTS,
		isUnlocked: progress => progress.level >= JOURNEY_LEVELS.FIGHTS
	},
	{
		feature: JOURNEY_FEATURES.GUILD, tab: JOURNEY_TABS.GUILD, route: "/guild", icon: "navigation.guild", level: JOURNEY_LEVELS.GUILD,
		isUnlocked: progress => progress.hasGuild || progress.level >= JOURNEY_LEVELS.GUILD
	},
	{
		feature: JOURNEY_FEATURES.PET, tab: JOURNEY_TABS.PET, route: "/pet", icon: "navigation.pet",
		isUnlocked: progress => progress.metPet
	}
];

export function unlockedFeatures(progress: JourneyProgress): JourneyFeature[] {
	return JOURNEY_STEPS.filter(step => step.isUnlocked(progress)).map(step => step.feature);
}

/** A tab opens with the first of its features. */
export function openTabs(unlocked: readonly JourneyFeature[]): JourneyTab[] {
	return [JOURNEY_TABS.ADVENTURE, ...Object.values(JOURNEY_TABS).filter(tab => JOURNEY_STEPS.some(step => step.tab === tab && unlocked.includes(step.feature)))];
}

/** The closest part of the game a level still keeps closed. */
export function nextLevelStep(progress: JourneyProgress): JourneyStep & {level: number} | null {
	const closed = JOURNEY_STEPS.filter((step): step is JourneyStep & {level: number} => step.level !== undefined && !step.isUnlocked(progress));
	return closed.reduce<JourneyStep & {level: number} | null>((closest, step) => closest === null || step.level < closest.level ? step : closest, null);
}
