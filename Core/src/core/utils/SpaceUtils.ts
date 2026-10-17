import { get } from "https";
import { IncomingMessage } from "http";
import {
	asSeconds, Millisecond
} from "../../../../Lib/src/types/TimeTypes";
import { secondsToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import {
	CrowniclesCoreMetrics, EXTERNAL_API_FAILURE_REASONS, EXTERNAL_APIS, ExternalApiFailureReason
} from "../bot/CrowniclesCoreMetrics";

const HTTP_STATUS_OK = 200;

type NeoWSCallHandlers = {
	succeed: (feed: NearEarthObject[]) => void;
	fail: (reason: ExternalApiFailureReason, error: unknown) => void;
};

// External library connections, naming conventions can't be easily applied
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
		return this.fetchNeoWSFeed(today);
	}

	private static parseNeoWSFeed(rawAnswer: string, day: string): NearEarthObject[] {
		const objectsByDay = JSON.parse(rawAnswer).near_earth_objects;
		return objectsByDay[day] ? objectsByDay[day] : objectsByDay;
	}

	private static readNeoWSResponse(res: IncomingMessage, day: string, handlers: NeoWSCallHandlers): void {
		if (res.statusCode !== HTTP_STATUS_OK) {
			res.resume();
			handlers.fail(EXTERNAL_API_FAILURE_REASONS.HTTP_STATUS, new Error(`NeoWS feed answered with HTTP status ${res.statusCode}`));
			return;
		}
		let data = "";
		res.on("data", chunk => {
			data += chunk;
		});
		res.on("error", error => {
			handlers.fail(EXTERNAL_API_FAILURE_REASONS.NETWORK, error);
		});
		res.on("end", () => {
			/*
			 * Everything that can throw must stay inside this try: an exception escaping here would
			 * leave the promise forever pending, and its caller stuck holding a database transaction
			 */
			try {
				handlers.succeed(SpaceUtils.parseNeoWSFeed(data, day));
			}
			catch (e) {
				handlers.fail(EXTERNAL_API_FAILURE_REASONS.INVALID_RESPONSE, e);
			}
		});
	}

	private static fetchNeoWSFeed(day: string): Promise<NearEarthObject[]> {
		CrowniclesCoreMetrics.incrementExternalApiCall(EXTERNAL_APIS.NEO_WS);
		return new Promise((resolve, reject) => {
			let settled = false;
			const handlers: NeoWSCallHandlers = {
				succeed: feed => {
					settled = true;
					this.cachedNeoFeedDate = day;
					this.cachedNeoFeed = feed;
					resolve(feed);
				},

				// The caller silently falls back to an empty feed, so a failure is only visible through logs and metrics
				fail: (reason, error) => {
					if (settled) {
						return;
					}
					settled = true;
					CrowniclesCoreMetrics.incrementExternalApiFailure(EXTERNAL_APIS.NEO_WS, reason);
					CrowniclesLogger.errorWithObj(`NeoWS feed call failed (${reason})`, error);
					reject(error);
				}
			};

			let timedOut = false;
			const request = get(SpaceUtils.NEO_WS_FEED_URL, res => {
				SpaceUtils.readNeoWSResponse(res, day, handlers);
			});
			request.on("error", error => {
				handlers.fail(timedOut ? EXTERNAL_API_FAILURE_REASONS.TIMEOUT : EXTERNAL_API_FAILURE_REASONS.NETWORK, error);
			});
			request.setTimeout(SpaceUtils.NEO_WS_REQUEST_TIMEOUT, () => {
				timedOut = true;
				request.destroy(new Error("NeoWS feed request timed out"));
			});
		});
	}
}
