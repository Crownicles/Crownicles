import { FromServerPacket } from "../FromServerPacket";
import {
	ExpeditionError, ExpeditionFood, ExpeditionFoodCause, ExpeditionLocation, ExpeditionProgress, ExpeditionRewards, PetBasicInfo
} from "../../objects/PetExpedition";

export class PetExpeditionRes extends FromServerPacket {
	public static readonly wireName = "PetExpeditionRes";

	public hasTalisman!: boolean;

	public hasExpeditionInProgress!: boolean;

	public expeditionInProgress?: ExpeditionProgress;

	public canStartExpedition!: boolean;

	public cannotStartReason?: ExpeditionError;

	public pet?: PetBasicInfo;
}

export class PetExpeditionStartedRes extends FromServerPacket {
	public static readonly wireName = "PetExpeditionStartedRes";

	public success!: boolean;

	public failureReason?: ExpeditionError;

	public expedition?: ExpeditionProgress;

	public foodConsumed?: number;

	public foodConsumedDetails?: ExpeditionFood[];

	public insufficientFood?: boolean;

	public insufficientFoodCause?: ExpeditionFoodCause;

	public originalDisplayDurationMinutes?: number;
}

export class PetExpeditionCancelRes extends FromServerPacket {
	public static readonly wireName = "PetExpeditionCancelRes";

	public loveLost!: number;

	public isFreeCancellation!: boolean;

	public pet!: PetBasicInfo;
}

export class PetExpeditionRecallRes extends FromServerPacket {
	public static readonly wireName = "PetExpeditionRecallRes";

	public loveLost!: number;

	public pet!: PetBasicInfo;
}

export class PetExpeditionResolveRes extends FromServerPacket {
	public static readonly wireName = "PetExpeditionResolveRes";

	public success!: boolean;

	public partialSuccess!: boolean;

	public totalFailure!: boolean;

	public rewards?: ExpeditionRewards;

	public loveChange!: number;

	public pet!: PetBasicInfo;

	public expedition!: ExpeditionLocation;

	public badgeEarned?: string;

	public petLikedExpedition!: boolean;
}

export class PetExpeditionErrorRes extends FromServerPacket {
	public static readonly wireName = "PetExpeditionErrorRes";

	public errorCode!: ExpeditionError;
}
