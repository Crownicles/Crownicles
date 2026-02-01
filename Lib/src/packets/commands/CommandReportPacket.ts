import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTravelSummaryRes extends CrowniclesPacket {
	startMap!: {
		id: number;
		type: string;
	};

	endMap!: {
		id: number;
		type: string;
	};

	startTime!: number;

	arriveTime!: number;

	nextStopTime!: number;

	isOnBoat!: boolean;

	effect?: string;

	effectDuration?: number;

	effectEndTime?: number;

	points!: {
		show: boolean;
		cumulated: number;
	};

	energy!: {
		show: boolean;
		current: number;
		max: number;
	};

	lastSmallEventId?: string;

	tokens?: {
		cost: number;
		playerTokens: number;
	};

	heal?: {
		price: number;
		playerMoney: number;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportMonsterRewardRes extends CrowniclesPacket {
	money!: number;

	experience!: number;

	guildXp!: number;

	guildPoints!: number;

	petReaction?: {
		reactionType: string;
		loveDelta: number;
		petId: number;
		petSex: string;
		petNickname?: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportErrorNoMonsterRes extends CrowniclesPacket {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportRefusePveFightRes extends CrowniclesPacket {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportChooseDestinationRes extends CrowniclesPacket {
	mapId!: number;

	mapTypeId!: string;

	tripDuration!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBigEventResultRes extends CrowniclesPacket {
	eventId!: number;

	possibilityId!: string;

	outcomeId!: string;

	score!: number;

	experience!: number;

	effect?: {
		name: string;
		time: number;
	};

	health!: number;

	money!: number;

	energy!: number;

	gems!: number;

	oneshot!: boolean;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportUseTokensPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUseTokensAcceptPacketRes extends CrowniclesPacket {
	tokensSpent!: number;

	isArrived!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUseTokensRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportBuyHealPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHealAcceptPacketRes extends CrowniclesPacket {
	healPrice!: number;

	isArrived!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHealRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHealNoAlterationPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHealCannotHealOccupiedPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportStayInCity extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportChooseDestinationCityRes extends CrowniclesPacket {
	mapId!: number;

	mapTypeId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportEatInnMealRes extends CrowniclesPacket {
	energy!: number;

	moneySpent!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportEatInnMealCooldownRes extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportSleepRoomRes extends CrowniclesPacket {
	roomId!: string;

	health!: number;

	moneySpent!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportNotEnoughMoneyRes extends CrowniclesPacket {
	missingMoney!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportEnchantNotEnoughCurrenciesRes extends CrowniclesPacket {
	missingMoney!: number;

	missingGems!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportItemCannotBeEnchantedRes extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportItemEnchantedRes extends CrowniclesPacket {
	enchantmentId!: string;

	enchantmentType!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHomeRes extends CrowniclesPacket {
	cost!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUpgradeHomeRes extends CrowniclesPacket {
	cost!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportMoveHomeRes extends CrowniclesPacket {
	cost!: number;
}
