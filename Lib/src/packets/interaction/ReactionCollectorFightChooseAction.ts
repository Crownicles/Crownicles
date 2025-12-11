import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorFightChooseActionReaction extends ReactionCollectorReaction {
	id!: string;
}

export class ReactionCollectorFightChooseActionData extends ReactionCollectorData {
	fightId!: string;

	fighterKeycloakId!: string;
}

export type ReactionCollectorFightChooseActionPacket = ReactionCollectorCreationPacket<
	ReactionCollectorFightChooseActionData,
	ReactionCollectorFightChooseActionReaction
>;

export class ReactionCollectorFightChooseAction extends ReactionCollector {
	private readonly fightId: string;

	private readonly reactions: ReactionCollectorFightChooseActionReaction[];

	private readonly fighterKeycloackId: string;


	constructor(fightId: string, fighterKeycloakId: string, reactions: string[]) {
		super();
		this.fightId = fightId;
		this.reactions = reactions.map(r => ({
			id: r
		}));
		this.fighterKeycloackId = fighterKeycloakId;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorFightChooseActionPacket {
		const reactions = [];
		for (const reaction of this.reactions) {
			reactions.push(this.buildReaction(ReactionCollectorFightChooseActionReaction, reaction));
		}

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorFightChooseActionData, {
				fightId: this.fightId,
				fighterKeycloakId: this.fighterKeycloackId
			})
		};
	}
}
