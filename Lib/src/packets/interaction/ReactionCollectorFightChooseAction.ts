import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorFightChooseActionReaction extends ReactionCollectorReaction {
	id!: string;

	// Damage multiplier of the action when it changes during the fight (e.g. the dark attack wears down with each use)
	powerMultiplier?: number;
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


	constructor(fightId: string, fighterKeycloakId: string, reactions: ReactionCollectorFightChooseActionReaction[]) {
		super();
		this.fightId = fightId;
		this.reactions = reactions;
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
