import { Maps } from "../../maps/Maps";
import { FightPetActionFunc } from "../../../data/FightPetAction";
import { PetUtils } from "../../utils/PetUtils";

export const fightPetAction: FightPetActionFunc = async (player, pet) => PetUtils.getPetVigor(pet, 0, { enraged: true }) <= (await Maps.getGuildMembersOnPveIsland(player)).length;
