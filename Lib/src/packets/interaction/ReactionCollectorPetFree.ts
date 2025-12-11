import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { SexTypeShort } from "../../constants/StringConstants";

export class ReactionCollectorPetFreeData extends ReactionCollectorData {
	petId!: number;

	petSex!: SexTypeShort;

	petNickname?: string;

	freeCost!: number;
}

export type ReactionCollectorPetFreePacket = AcceptRefusePacket<ReactionCollectorPetFreeData>;

export class ReactionCollectorPetFree extends ReactionCollector {
	private readonly petId: number;

	private readonly petSex: SexTypeShort;

	private readonly petNickname: string | undefined;

	private readonly freeCost: number;

	constructor(petId: number, petSex: SexTypeShort, petNickname: string | undefined, freeCost: number) {
		super();
		this.petId = petId;
		this.petSex = petSex;
		this.petNickname = petNickname;
		this.freeCost = freeCost;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorPetFreePacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorPetFreeData, {
				petId: this.petId,
				petSex: this.petSex,
				petNickname: this.petNickname,
				freeCost: this.freeCost
			})
		};
	}
}
