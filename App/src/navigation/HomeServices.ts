import type { Href } from "expo-router";

export const HOME_SERVICES = {
	CHEST: "chest", COOKING: "cooking", GARDEN: "garden"
} as const;
export type HomeService = typeof HOME_SERVICES[keyof typeof HOME_SERVICES];

export const HOME_SERVICE_DESTINATIONS = {
	homeChest: HOME_SERVICES.CHEST, homeCooking: HOME_SERVICES.COOKING, homeGarden: HOME_SERVICES.GARDEN
} as const;

/** The page of a home service: opened from the city at home, or from the road for the garden the Cœur sylvestre reaches. */
export function homeServiceHref(service: HomeService): Href {
	return {
		pathname: "/home/[service]", params: { service }
	};
}
