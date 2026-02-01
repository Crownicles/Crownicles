import {
	IMission, MissionParams
} from "./IMission";

export class MissionTag implements IMission {
	public tagNames!: string[];

	constructor(tagsToProc: string[]) {
		this.tagNames = tagsToProc;
	}

	areParamsMatchingVariantAndBlob(_variant: number, params: MissionParams): boolean {
		for (const tag in this.tagNames) {
			if (tag in (params.tags as string[])) {
				return true;
			}
		}
		return false;
	}

	generateRandomVariant(): number {
		return 0;
	}

	initialNumberDone(): number {
		return 0;
	}

	updateSaveBlob(): Buffer | null {
		return null;
	}
}
