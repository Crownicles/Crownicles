import { ReactionCollectorCityData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorCity";

/**
 * Manage-home payload shared between the city main menu and the notary sub-menu.
 */
export type ManageHomeData = NonNullable<ReactionCollectorCityData["home"]["manage"]>;
