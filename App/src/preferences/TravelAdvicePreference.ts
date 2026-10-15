import {
	DevicePreference, useDevicePreference
} from "@/src/preferences/DevicePreference";

const TRAVEL_ADVICES = {
	SHOWN: "shown",
	HIDDEN: "hidden"
} as const;
type TravelAdvices = typeof TRAVEL_ADVICES[keyof typeof TRAVEL_ADVICES];

/** Whether the adventure screen shows the traveller's advices; a device setting, like the theme. */
const travelAdvices = new DevicePreference<TravelAdvices>("travelAdvices", Object.values(TRAVEL_ADVICES), TRAVEL_ADVICES.SHOWN);

export const travelAdvicePreference = {
	set: (shown: boolean): void => travelAdvices.set(shown ? TRAVEL_ADVICES.SHOWN : TRAVEL_ADVICES.HIDDEN)
};

export function useTravelAdvicesShown(): boolean {
	return useDevicePreference(travelAdvices) === TRAVEL_ADVICES.SHOWN;
}
