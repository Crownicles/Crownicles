import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";
import { HomeLevel } from "../../../Lib/src/types/HomeLevel";

export class InnMeal {
	public readonly id: string;

	public readonly price: number;

	public readonly energy: number;
}

export class InnRoom {
	public readonly id: string;

	public readonly price: number;

	public readonly health: number;
}

export class CityInn {
	public readonly id: string;

	public readonly meals: InnMeal[];

	public readonly rooms: InnRoom[];
}

export class City extends Data<string> {
	public readonly mapLinks: number[];

	public readonly maps: number[];

	public readonly inns: CityInn[];

	public readonly shops?: string[];

	public getTodayInnMeals(inn: CityInn, date: Date): InnMeal[] {
		let seed = date.getDate();
		seed += new Date().getMonth() * 100;
		seed += new Date().getFullYear() * 10000;

		const meals: InnMeal[] = [];

		let availableMeals = [...inn.meals];
		while (meals.length < 3 && availableMeals.length > 0) {
			const index = (seed * 9301 + 49297) % 233280 % availableMeals.length;
			meals.push(availableMeals[index]);
			availableMeals = availableMeals.filter((_, i) => i !== index);
			seed += 1;
		}

		return meals;
	}

	public getHomeLevelPrice(homeLevel: HomeLevel, cityPopulationCounts: {
		cityId: string;
		count: number;
	}[]): number {
		// Get population values
		const totalPopulation = cityPopulationCounts.reduce((sum, city) => sum + city.count, 0);
		const cityPopulation = cityPopulationCounts.find(city => city.cityId === this.id)?.count || 0;
		const isTheMostPopularCity = cityPopulationCounts.length === 0 || cityPopulation === Math.max(...cityPopulationCounts.map(city => city.count));

		// Calculate ponderation
		let ponderation = totalPopulation === 0 ? 0 : cityPopulation / totalPopulation;
		if (ponderation < HomeConstants.PONDERATION_MINIMUM) {
			ponderation = HomeConstants.PONDERATION_MINIMUM;
		}

		// Calculate price
		let price = homeLevel.cost;
		price *= ponderation;
		if (isTheMostPopularCity) {
			price *= HomeConstants.MOST_POPULATED_CITY_PRICE_MALUS;
		}

		return Math.floor(price);
	}
}

export class CityDataController extends DataControllerString<City> {
	static readonly instance: CityDataController = new CityDataController("cities");

	static mapLinksCache: Map<number, City> = null;

	static mapCache: Map<number, City> = null;

	newInstance(): City {
		return new City();
	}

	getCityByMapLinkId(mapLinkId: number): City | undefined {
		if (!CityDataController.mapLinksCache) {
			this.initMapLinksCache();
		}
		return CityDataController.mapLinksCache.get(mapLinkId);
	}

	getCityByMapId(mapId: number): City | undefined {
		if (!CityDataController.mapCache) {
			this.initMapCache();
		}
		return CityDataController.mapCache.get(mapId);
	}

	getRandomCity(): City {
		if (!CityDataController.mapCache) {
			this.initMapCache();
		}
		return RandomUtils.crowniclesRandom.pick(Array.from(CityDataController.mapCache.values()));
	}

	private initMapLinksCache(): void {
		if (!CityDataController.mapLinksCache) {
			CityDataController.mapLinksCache = new Map<number, City>();
			for (const city of this.data.values()) {
				for (const link of city.mapLinks) {
					CityDataController.mapLinksCache.set(link, city);
				}
			}
		}
	}

	private initMapCache(): void {
		if (!CityDataController.mapCache) {
			CityDataController.mapCache = new Map<number, City>();
			for (const city of this.data.values()) {
				for (const map of city.maps) {
					CityDataController.mapCache.set(map, city);
				}
			}
		}
	}
}
