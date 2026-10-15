import { FromServerPacket } from "../FromServerPacket";

/** The player confirmed spending tokens to advance their journey. */
export class ReportUseTokensAcceptedRes extends FromServerPacket {
	public static readonly wireName = "ReportUseTokensAcceptedRes";

	tokensSpent!: number;

	isArrived!: boolean;
}

/** The player chose not to spend their tokens. */
export class ReportUseTokensRefusedRes extends FromServerPacket {
	public static readonly wireName = "ReportUseTokensRefusedRes";
}

/** A token bundle was bought from the report merchant. */
export class ReportTokenMerchantBoughtRes extends FromServerPacket {
	public static readonly wireName = "ReportTokenMerchantBoughtRes";

	amount!: number;
}

/** The merchant cannot sell more tokens under the current purchase limits. */
export class ReportTokenMerchantTooMuchRes extends FromServerPacket {
	public static readonly wireName = "ReportTokenMerchantTooMuchRes";
}

/** The player's token pouch is already full. */
export class ReportTokenMerchantFullRes extends FromServerPacket {
	public static readonly wireName = "ReportTokenMerchantFullRes";
}

/** The player declined the merchant's offer. */
export class ReportTokenMerchantRefusedRes extends FromServerPacket {
	public static readonly wireName = "ReportTokenMerchantRefusedRes";
}

/** The player cannot afford a token bundle. */
export class ReportTokenMerchantCannotAffordRes extends FromServerPacket {
	public static readonly wireName = "ReportTokenMerchantCannotAffordRes";
}

/** The merchant granted a weekly token charity. */
export class ReportTokenMerchantCharityRes extends FromServerPacket {
	public static readonly wireName = "ReportTokenMerchantCharityRes";

	amount!: number;
}

/** The player has already received the weekly token charity. */
export class ReportTokenMerchantCharityAlreadyUsedRes extends FromServerPacket {
	public static readonly wireName = "ReportTokenMerchantCharityAlreadyUsedRes";
}
