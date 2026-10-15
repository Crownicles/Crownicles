import { GameRules } from "../../../WsPackets/src/objects/GameRules";
import { TextRule as WireTextRule } from "../../../WsPackets/src/objects/TextRules";
import {
	TextRule, TextRuleConstants
} from "../../../Lib/src/constants/TextRuleConstants";
import { GuildConstants } from "../../../Lib/src/constants/GuildConstants";
import { GuildCreateConstants } from "../../../Lib/src/constants/GuildCreateConstants";
import { GuildRecruitmentConstants } from "../../../Lib/src/constants/GuildRecruitmentConstants";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { ONBOARDING_TRIALS } from "../../../Lib/src/constants/OnboardingConstants";
import { PetSellConstants } from "../../../Lib/src/constants/PetSellConstants";
import { PVEConstants } from "../../../Lib/src/constants/PVEConstants";
import { PlayersConstants } from "../../../Lib/src/constants/PlayersConstants";
import { HomeConstants } from "../../../Lib/src/constants/HomeConstants";
import { GardenConstants } from "../../../Lib/src/constants/GardenConstants";
import { TimeConstants } from "../../../Lib/src/constants/TimeConstants";

function toWireTextRule(rule: TextRule): WireTextRule {
	return {
		min: rule.lengthRange.MIN,
		max: rule.lengthRange.MAX,
		allowedCharacters: rule.allowedCharacters,
		forbiddenPatterns: rule.forbiddenPatterns.map(forbidden => ({ ...forbidden }))
	};
}

/** Core's values the app reads instead of keeping its own copy. */
export function buildGameRules(): GameRules {
	return {
		textRules: {
			guildName: toWireTextRule(TextRuleConstants.GUILD_NAME),
			guildDescription: toWireTextRule(TextRuleConstants.GUILD_DESCRIPTION),
			petNickname: toWireTextRule(TextRuleConstants.PET_NICKNAME)
		},
		guild: {
			creationPrice: GuildCreateConstants.PRICE,
			maxMembers: GuildConstants.MAX_GUILD_MEMBERS,
			recruitmentMinScoreSteps: [...GuildRecruitmentConstants.MIN_SCORE_STEPS]
		},
		journeyLevels: {
			classes: ClassConstants.REQUIRED_LEVEL,
			fights: FightConstants.REQUIRED_LEVEL,
			guild: GuildConstants.REQUIRED_LEVEL
		},
		fight: {
			minimalEnergyRatio: PVEConstants.MINIMAL_ENERGY_RATIO
		},
		pet: {
			sellPrice: {
				min: PetSellConstants.SELL_PRICE.MIN,
				max: PetSellConstants.SELL_PRICE.MAX
			}
		},
		cooldownHours: {
			innMeal: PlayersConstants.MEAL_COOLDOWN / TimeConstants.MS_TIME.HOUR,
			innRoom: HomeConstants.BED_COOLDOWN_MS / TimeConstants.MS_TIME.HOUR,
			gardenWatering: GardenConstants.WATERING_COOLDOWN_MS / TimeConstants.MS_TIME.HOUR
		},
		apartment: {
			dailyRent: HomeConstants.DAILY_RENT,
			minRentToClaim: HomeConstants.MIN_RENT_TO_CLAIM,
			bedLevelCap: HomeConstants.APARTMENT_BED_LEVEL_CAP
		},
		onboardingTrials: ONBOARDING_TRIALS.map(trial => ({
			id: trial.id,
			missions: [...trial.missions]
		}))
	};
}
