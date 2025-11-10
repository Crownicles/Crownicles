import { get } from "https";

// External library connections, naming conventions can't be easily applied
/* eslint-disable camelcase */

export interface NearEarthObjectApproachData {
	close_approach_date: string;
	close_approach_date_full: string;
	epoch_date_close_approach: number;
	relative_velocity: {
		kilometers_per_second: string;
		kilometers_per_hour: string;
		miles_per_hour: string;
	};
	miss_distance: {
		astronomical: string;
		lunar: string;
		kilometers: string;
		miles: string;
	};
	orbiting_body: string;
}

export interface EstimatedDiameterMinMax {
	estimated_diameter_min: number;
	estimated_diameter_max: number;
}

export interface NearEarthObject {
	links: { self: string };
	id: string;
	neo_reference_id: string;
	name: string;
	nasa_jpl_url: string;
	absolute_magnitude_h: number;
	estimated_diameter: {
		kilometers: EstimatedDiameterMinMax;
		meters: EstimatedDiameterMinMax;
		miles: EstimatedDiameterMinMax;
		feet: EstimatedDiameterMinMax;
	};
	is_potentially_hazardous_asteroid: boolean;
	close_approach_data: NearEarthObjectApproachData[];
	is_sentry_object: boolean;
}

export class SpaceUtils {
	private static cachedNeoFeed: NearEarthObject[] = null;

	private static cachedNeoFeedDate: string = null;

	static getNeoWSFeed(): Promise<NearEarthObject[]> {
		const today = new Date().toISOString()
			.slice(0, 10);
		if (today === this.cachedNeoFeedDate) {
			return Promise.resolve(this.cachedNeoFeed);
		}
		return new Promise(resolve => {
			get("https://www.neowsapp.com/rest/v1/feed/today", res => {
				let data = "";
				res.on("data", chunk => {
					data += chunk;
				});
				res.on("end", () => {
					const parsedAnswer = JSON.parse(data);
					try {
						if (parsedAnswer.near_earth_objects[today]) {
							parsedAnswer.near_earth_objects = parsedAnswer.near_earth_objects[today];
						}
						this.cachedNeoFeedDate = today;
						this.cachedNeoFeed = parsedAnswer.near_earth_objects;
						resolve(parsedAnswer.near_earth_objects);
					}
					catch {
						resolve(null);
					}
				});
			});
		});
	}
}
