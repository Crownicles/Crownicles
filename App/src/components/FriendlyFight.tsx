import { ReactNode } from "react";
import { ProfileRes } from "ws-packets/src/fromServer/profile/ProfileRes";
import {
	ActionBanner, Lock, Refusal
} from "@/src/design/Sections";
import { Swords } from "@/src/design/FightIcons";
import {
	activeEffect, effectLock
} from "@/src/display/CommandRejection";
import { gameRules } from "@/src/rules/GameRules";
import {
	fightStore, isFightOngoing, useFight
} from "@/src/store/FightStore";
import { useFriendlyFight } from "@/src/store/useFriendlyFight";
import { usePlayerProfile } from "@/src/store/usePlayerProfile";
import { i18n } from "@/src/translations/i18n";

/** Both players must have unlocked fights, and the asking one must be free to fight. */
function friendlyFightLock(own: ProfileRes, opponent: ProfileRes): Lock | undefined {
	const fightsLevel = gameRules().journeyLevels.fights;
	if (own.level < fightsLevel) {
		return { reason: i18n.t("app:arena.locked", { level: fightsLevel }) };
	}
	if (opponent.level < fightsLevel) {
		return { reason: i18n.t("app:friendlyFight.errors.opponentLevelTooLow") };
	}
	const effect = activeEffect(own);
	return effect ? effectLock(effect) : undefined;
}

/** A consequence-free duel against a player met in a ranking or a guild, offered on their profile. */
export function FriendlyFightPlayer({
	playerRef, profile
}: {
	playerRef: string; profile: ProfileRes;
}): ReactNode {
	const own = usePlayerProfile();
	const fight = useFight();
	const {
		pending, message, start
	} = useFriendlyFight();
	if (own.status !== "ready") {
		return null;
	}

	// A fight already under way can always be resumed, whoever it is against.
	const ongoing = isFightOngoing(fight);
	const lock = ongoing ? undefined : friendlyFightLock(own.data, profile);
	return <>
		{message ? <Refusal>{message}</Refusal> : null}
		<ActionBanner
			icon={Swords}
			label={ongoing ? i18n.t("app:arena.resume") : i18n.t("app:friendlyFight.start", { pseudo: profile.pseudo })}
			{...ongoing ? {} : { detail: i18n.t("app:friendlyFight.detail", { levelCap: gameRules().friendlyFight.levelCap }) }}
			pending={pending}
			{...lock ? { lock } : {}}
			onPress={ongoing
				? fightStore.show
				: (): void => {
					start(playerRef).catch(console.error);
				}}
			testID="profile-friendly-fight"
		/>
	</>;
}
