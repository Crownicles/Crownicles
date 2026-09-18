export const HOME_SERVICES = {CHEST: "chest", COOKING: "cooking", GARDEN: "garden"} as const;
export type HomeService = typeof HOME_SERVICES[keyof typeof HOME_SERVICES];

export const HOME_SERVICE_DESTINATIONS = {homeChest: HOME_SERVICES.CHEST, homeCooking: HOME_SERVICES.COOKING, homeGarden: HOME_SERVICES.GARDEN} as const;