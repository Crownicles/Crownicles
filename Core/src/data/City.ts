import { DataControllerString } from "./DataController";
import { Data } from "./Data";

export class InnMeal {
	public readonly id: string;

	public readonly quality: number; // 1-5, 1 being the worst, 5 being the best

	public readonly price: number;

	public readonly healthRestored: number;
}

export class CityInn {
	public readonly id: string;

	public readonly meals: InnMeal[];
}

export class City extends Data<string> {
	public readonly mapLinks: number[];

	public readonly inns: string[];
}

export class CityDataController extends DataControllerString<City> {
	static readonly instance: CityDataController = new CityDataController("cities");

	static mapLinksCache: Map<number, City> = null;

	newInstance(): City {
		return new City();
	}

	getCityByMapLinkId(mapLinkId: number): City | undefined {
		if (!CityDataController.mapLinksCache) {
			this.initMapLinksCache();
		}
		return CityDataController.mapLinksCache.get(mapLinkId);
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
}
