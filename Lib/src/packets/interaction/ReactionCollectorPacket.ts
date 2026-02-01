import {
	CrowniclesPacket, PacketDirection, PacketLike, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class ReactionCollectorReactPacket extends CrowniclesPacket {
	id!: string;

	keycloakId!: string;

	reactionIndex!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ReactionCollectorEnded extends CrowniclesPacket {

}

export abstract class ReactionCollectorReaction {

}

export abstract class ReactionCollectorData {

}

export class ReactionCollectorAcceptReaction extends ReactionCollectorReaction {

}

export class ReactionCollectorRefuseReaction extends ReactionCollectorReaction {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ReactionCollectorCreationPacket<
	TData extends ReactionCollectorData = ReactionCollectorData,
	TReaction extends ReactionCollectorReaction = ReactionCollectorReaction
> extends CrowniclesPacket {
	id!: string;

	data!: {
		type: string;
		data: TData;
	};

	reactions!: {
		type: string;
		data: TReaction;
	}[];

	endTime!: number;

	mainPacket?: boolean = true;
}

export abstract class ReactionCollector {
	buildData<T extends ReactionCollectorData>(Packet: PacketLike<T>, { ...args }: T): {
		type: string;
		data: T;
	} {
		const instance = new Packet();
		Object.assign(instance, args);
		return {
			type: instance.constructor.name,
			data: instance
		};
	}

	buildReaction<T extends ReactionCollectorReaction>(Packet: PacketLike<T>, { ...args }: T): {
		type: string;
		data: T;
	} {
		const instance = new Packet();
		Object.assign(instance, args);
		return {
			type: instance.constructor.name,
			data: instance
		};
	}

	abstract creationPacket(id: string, endTime: number, mainPacket: boolean): ReactionCollectorCreationPacket;
}

export type AcceptRefuseReaction = ReactionCollectorAcceptReaction | ReactionCollectorRefuseReaction;

export type AcceptRefusePacket<TData extends ReactionCollectorData> = ReactionCollectorCreationPacket<TData, AcceptRefuseReaction>;
