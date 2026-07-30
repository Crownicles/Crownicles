import { get } from "https";
import {
	asSeconds, Millisecond
} from "../../../../Lib/src/types/TimeTypes";
import { secondsToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";

const HTTP_STATUS_OK = 200;

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

export abstract class SpaceUtils {
	private static readonly NEO_WS_FEED_URL = "https://www.neowsapp.com/rest/v1/feed/today";

	private static readonly NEO_WS_REQUEST_TIMEOUT: Millisecond = secondsToMilliseconds(asSeconds(10));

	private static cachedNeoFeed: NearEarthObject[] | undefined = undefined;

	private static cachedNeoFeedDate: string | undefined = undefined;

	static getNeoWSFeed(): Promise<NearEarthObject[]> {
		const today = new Date().toISOString()
			.slice(0, 10);
		if (today === this.cachedNeoFeedDate && this.cachedNeoFeed) {
			return Promise.resolve(this.cachedNeoFeed);
		}
		return new Promise((resolve, reject) => {
			const request = get(SpaceUtils.NEO_WS_FEED_URL, res => {
				if (res.statusCode !== HTTP_STATUS_OK) {
					res.resume();
					reject(new Error(`NeoWS feed answered with HTTP status ${res.statusCode}`));
					return;
				}
				let data = "";
				res.on("data", chunk => {
					data += chunk;
				});
				res.on("error", reject);
				res.on("end", () => {
					/*
					 * Everything that can throw must stay inside this try: an exception escaping here would
					 * leave the promise forever pending, and its caller stuck holding a database transaction
					 */
					try {
						const parsedAnswer = JSON.parse(data);
						if (parsedAnswer.near_earth_objects[today]) {
							parsedAnswer.near_earth_objects = parsedAnswer.near_earth_objects[today];
						}
						this.cachedNeoFeedDate = today;
						this.cachedNeoFeed = parsedAnswer.near_earth_objects;
						resolve(parsedAnswer.near_earth_objects);
					}
					catch (e) {
						reject(e);
					}
				});
			});
			request.on("error", reject);
			request.setTimeout(SpaceUtils.NEO_WS_REQUEST_TIMEOUT, () => {
				request.destroy(new Error("NeoWS feed request timed out"));
			});
		});
	}
}
