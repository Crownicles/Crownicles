/**
 * Custom ESLint rules for the Crownicles project
 */

import singleLineShortSinglePropertyObject from "./single-line-short-single-property-object.mjs";
import noUnguardedSave from "./no-unguarded-save.mjs";
import noThisInPacketHandler from "./no-this-in-packet-handler.mjs";

export default {
	rules: {
		"single-line-short-single-property-object": singleLineShortSinglePropertyObject,
		"no-unguarded-save": noUnguardedSave,
		"no-this-in-packet-handler": noThisInPacketHandler
	}
};
