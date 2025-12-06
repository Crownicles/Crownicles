import { SexTypeShort } from "../constants/StringConstants";

/**
 * Basic pet information commonly used in packets and displays
 */
export interface PetBasicInfo {
	petTypeId: number;
	petSex: SexTypeShort;
	petNickname?: string;
}
