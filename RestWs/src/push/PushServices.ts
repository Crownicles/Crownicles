import {
	PUSH_PLATFORMS, PushDevice, PushPlatform
} from "../../../Lib/src/types/PushDevices";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { PushConfig } from "../config/RestWsConfig";
import { ApnsClient } from "./ApnsClient";
import { FcmClient } from "./FcmClient";
import {
	PUSH_RESULTS, PushMessage, PushResult, PushSender
} from "./PushSender";

/** The push service of each platform this server has credentials for. */
export class PushServices {
	private readonly senders: Map<PushPlatform, PushSender>;

	public constructor(senders: Map<PushPlatform, PushSender>) {
		this.senders = senders;
	}

	/** A service whose credentials cannot be read stays off rather than stopping RestWs: the app still works without it. */
	public static fromConfig(config: PushConfig): PushServices {
		const senders = new Map<PushPlatform, PushSender>();
		const enable = (platform: PushPlatform, create: () => PushSender): void => {
			try {
				senders.set(platform, create());
				CrowniclesLogger.info("Push notifications enabled", { platform });
			}
			catch (error) {
				CrowniclesLogger.errorWithObj(`Push notifications disabled for ${platform}: unreadable credentials`, error);
			}
		};
		if (config.APNS.KEY_PATH) {
			enable(PUSH_PLATFORMS.IOS, () => new ApnsClient(config.APNS));
		}
		if (config.FCM.SERVICE_ACCOUNT_PATH) {
			enable(PUSH_PLATFORMS.ANDROID, () => new FcmClient(config.FCM.SERVICE_ACCOUNT_PATH));
		}
		return new PushServices(senders);
	}

	public async send(device: PushDevice, message: PushMessage): Promise<PushResult> {
		const sender = this.senders.get(device.platform);
		if (!sender) {
			return PUSH_RESULTS.UNAVAILABLE;
		}
		try {
			return await sender.send(device, message);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Could not push a notification to ${device.platform}`, error);
			return PUSH_RESULTS.FAILED;
		}
	}
}
