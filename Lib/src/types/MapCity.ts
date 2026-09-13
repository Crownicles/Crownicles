import { CityService } from "../constants/CityServiceConstants";

export type MapCity = {
	id: string; mapLocationId: number; services: CityService[]; shops: string[];
};
