import { KeycloakUserConsent } from "./KeycloakUserConsent";
import { KeycloakCredential } from "./KeycloakCredential";
import { KeycloakFederalIdentity } from "./KeycloakFederalIdentity";
import { Language } from "../Language";

export interface KeycloakUser {
	access: { [key: string]: boolean[] };
	attributes: {
		gameUsername: [string]; language?: [Language]; discordId?: [string];
	};
	clientConsents?: KeycloakUserConsent[];
	clientRoles?: { [key: string]: string[] };
	createdTimestamp: number;
	credentials?: KeycloakCredential[];
	disableableCredentialTypes: string[];
	email?: string;
	emailVerified: boolean;
	enabled: boolean;
	federatedIdentities?: KeycloakFederalIdentity[];
	federationLink?: string;
	firstName: string;
	groups?: string[];
	id: string;
	lastName: string;
	notBefore: number;
	origin?: string;
	realmRoles?: string[];
	requiredActions: string[];
	self?: string;
	serviceAccountClientId?: string;
	username: string;
}
