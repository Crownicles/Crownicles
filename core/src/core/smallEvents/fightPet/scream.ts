import {FightPetActionFunc} from "../../../data/FightPetAction";
import {RandomUtils} from "../../utils/RandomUtils";

export const fightPetAction: FightPetActionFunc = (_player, _pet, isFemale) =>
// Succeeds 4/10 if the pet is masculine, 6/10 if the pet is feminine
	RandomUtils.draftbotRandom.bool(isFemale ? 0.4 : 0.6);
