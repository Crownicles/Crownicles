export const HOME_SERVICES = {CHEST: "chest", COOKING: "cooking"} as const;
export type HomeService = typeof HOME_SERVICES[keyof typeof HOME_SERVICES];

export const HOME_SERVICE_DESTINATIONS = {homeChest: HOME_SERVICES.CHEST, homeCooking: HOME_SERVICES.COOKING} as const;