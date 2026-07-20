import {
	CITY_SERVICES, CityService
} from "../../../../Lib/src/constants/CityServiceConstants";

export type CityServiceAvailability = Record<CityService, boolean>;

export function getAvailableCityServices(availability: CityServiceAvailability): CityService[] {
	return Object.values(CITY_SERVICES).filter(service => availability[service]);
}
