import {useNavigation, useRouter} from "expo-router";
import {ReactNode, useEffect, useState} from "react";
import {ActivityIndicator, StyleSheet, View} from "react-native";
import {RequestState} from "@/src/store/useGameQuery";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {FightGauge} from "@/src/components/FightGauge";
import {gaugeEmoji} from "@/src/components/Guild";
import {AppIcons} from "@/src/AppIcons";
import {
	EmptyState,
	KeyValue,
	Note,
	Panel,
	QuickAction,
	QuickActions,
	Screen,
	SectionHeader
} from "@/src/design/Primitives";
import {ExpandableEntry, ExpandableList, Figure, Figures, Standing} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {formatNumber} from "@/src/display/Amounts";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const NO_MINUTES = 0;
const PET_RARITY_MIN = 0;
const PET_RARITY_MAX = 8;
const CAMPAIGN_COMPLETE = 100;
const UNRANKED_GLORY = -1;
const SECTION_EMBLEM_SIZE = 26;
const STANDING_EMBLEM_SIZE = 40;
type ProfilePage = "inventory" | "missions" | "guide" | "blessing";
const PROFILE_PAGES: {page: ProfilePage; icon: string}[] = [
	{page: "inventory", icon: "inventory.stock"},
	{page: "missions", icon: "missions.campaign"},
	{page: "guide", icon: "missions.book"},
	{page: "blessing", icon: "smallEvents.altar"}
];

const styles = StyleSheet.create({
	state: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Theme.spacing.xxl
	}
});

function numberValue(value: number): string {
	return i18n.t("app:profile.formats.number", {value});
}

function progressValue(value: number, max: number): string {
	return i18n.t("app:profile.formats.progress", {value, max});
}

function percentageValue(value: number): string {
	return i18n.t("app:profile.formats.percentage", {value});
}

function duration(milliseconds: number): string {
	const totalMinutes = Math.max(Math.ceil(milliseconds / MILLISECONDS_PER_MINUTE), NO_MINUTES);
	const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
	if (hours > 0) {
		return i18n.t("app:adventure.duration.hoursMinutes", {
			hours,
			minutes: totalMinutes % MINUTES_PER_HOUR
		});
	}
	return i18n.t("app:adventure.duration.minutes", {count: totalMinutes});
}

function iconLabel(path: string, label: string): string {
	return `${AppIcons.getIcon(path)} ${label}`;
}

function classLabel(profile: ProfileRes): string {
	if (profile.classId === undefined) {
		return i18n.t("app:profile.values.unknown");
	}
	const icon = AppIcons.getIconOrNull(`classes.${profile.classId}`);
	const name = i18n.t(`models:classes.${profile.classId}`);
	return icon ? `${icon} ${name}` : name;
}

function locationLabel(profile: ProfileRes): string {
	if (profile.destinationId === undefined) {
		return i18n.t("app:profile.values.unknownLocation");
	}
	const name = i18n.t(`models:map_locations.${profile.destinationId}.name`);
	const icon = profile.mapTypeId ? AppIcons.getIconOrNull(`mapTypes.${profile.mapTypeId}`) : null;
	return icon ? `${icon} ${name}` : name;
}

function shouldDisplayEffectTime(profile: ProfileRes): boolean {
	const {effect} = profile;
	return !effect.healed && effect.hasTimeDisplay && effect.effect !== "none";
}

function effectLabel(profile: ProfileRes): string {
	return i18n.t("commands:profile.timeLeft.fieldValue", {
		effectId: profile.effect.effect,
		timeLeft: duration(profile.effect.timeLeft)
	});
}

function petLabel(profile: ProfileRes): string {
	if (!profile.pet) {
		return i18n.t("app:profile.values.none");
	}
	const {pet} = profile;
	const icon = AppIcons.getIcon(`pets.${pet.typeId}.${pet.sex === "f" ? "emoteFemale" : "emoteMale"}`);
	const typeName = i18n.t(`models:pets:${pet.typeId}`, {context: pet.sex === "f" ? "female" : "male"});
	const rarity = i18n.t(`items:rarities.${Math.min(PET_RARITY_MAX, Math.max(PET_RARITY_MIN, pet.rarity))}`);
	return `${icon} ${pet.nickname || typeName} · ${rarity}`;
}

/** What the player carries, right under who they are. */
function walletFigures(profile: ProfileRes): Figure[] {
	return [
		{caption: i18n.t("app:profile.fields.money"), value: formatNumber(profile.money), unit: "money"},
		{caption: i18n.t("app:profile.fields.gems"), value: formatNumber(profile.missions.gems), unit: "gem"},
		...profile.tokens ? [{caption: i18n.t("app:profile.fields.tokens"), value: progressValue(profile.tokens.value, profile.tokens.max), unit: "token"}] : []
	];
}

function ProfileStanding({profile}: {profile: ProfileRes}): ReactNode {
	const classIcon = profile.classId === undefined ? null : AppIcons.getIconOrNull(`classes.${profile.classId}`);
	return (
		<Standing
			testID="profile-standing"
			emblem={classIcon ? <TwemojiIcon emoji={classIcon} size={STANDING_EMBLEM_SIZE} /> : null}
			caption={i18n.t("app:profile.eyebrow")}
			title={profile.pseudo}
			subtitle={i18n.t("app:profile.subtitle", {
				className: classLabel(profile),
				level: profile.level,
				location: locationLabel(profile)
			})}
		>
			<FightGauge
				label={i18n.t("app:profile.fields.health")}
				value={profile.health.value}
				max={profile.health.max}
				color={Theme.colors.red}
				{...gaugeEmoji("unitValues.health")}
			/>
			<FightGauge
				label={i18n.t("app:profile.fields.experience")}
				value={profile.experience.value}
				max={profile.experience.max}
				color={Theme.colors.gold}
				{...gaugeEmoji("unitValues.xp")}
			/>
			<Figures items={walletFigures(profile)} />
		</Standing>
	);
}

type ProfileSection = {id: string; icon: string; label: string; caption: string; content: ReactNode};

function statisticsSection(profile: ProfileRes): ProfileSection | null {
	if (!profile.stats) {
		return null;
	}
	const {stats} = profile;
	return {
		id: "statistics",
		icon: "unitValues.attack",
		label: i18n.t("app:profile.titles.statistics"),
		caption: progressValue(stats.energy.value, stats.energy.max),
		content: <>
			<Figures items={[
				{caption: i18n.t("app:profile.fields.attack"), value: numberValue(stats.attack), unit: "attack"},
				{caption: i18n.t("app:profile.fields.defense"), value: numberValue(stats.defense), unit: "defense"},
				{caption: i18n.t("app:profile.fields.speed"), value: numberValue(stats.speed), unit: "speed"}
			]} />
			<Figures items={[
				{caption: i18n.t("app:profile.fields.breath"), value: progressValue(stats.breath.base, stats.breath.max), unit: "breath"},
				{caption: i18n.t("app:profile.fields.breathRegen"), value: numberValue(stats.breath.regen), unit: "breathRegen"}
			]} />
		</>
	};
}

function leagueLabel(league: number): string {
	const icon = AppIcons.getIconOrNull(`leagues.${league}`);
	const name = i18n.t(`models:leagues.${league}`);
	return icon ? `${icon} ${name}` : name;
}

function rankingSection(profile: ProfileRes): ProfileSection {
	const rank = profile.rank.unranked
		? i18n.t("app:profile.values.unranked")
		: i18n.t("app:profile.formats.rank", {rank: profile.rank.rank, players: profile.rank.numberOfPlayers});
	const fight = profile.fightRanking;
	const gloryRank = fight && fight.gloryRank !== UNRANKED_GLORY
		? i18n.t("app:profile.formats.rank", {rank: fight.gloryRank, players: fight.numberOfFighters})
		: i18n.t("app:profile.values.unranked");
	return {
		id: "ranking",
		icon: "announcements.trophy",
		label: i18n.t("app:profile.titles.scoreAndRank"),
		caption: rank,
		content: <>
			<Figures items={[
				{caption: i18n.t("app:profile.fields.score"), value: formatNumber(profile.rank.score), unit: "score"},
				...fight ? [{caption: i18n.t("app:profile.fields.glory"), value: formatNumber(fight.glory), unit: "glory"}] : []
			]} />
			{fight ? <>
				<KeyValue label={i18n.t("app:profile.fields.gloryRank")} value={gloryRank} />
				<KeyValue label={i18n.t("app:profile.fields.league")} value={leagueLabel(fight.league)} />
			</> : null}
		</>
	};
}

function campaignSection(profile: ProfileRes): ProfileSection {
	return {
		id: "missions",
		icon: "missions.campaign",
		label: i18n.t("app:profile.fields.campaign"),
		caption: percentageValue(profile.missions.campaignProgression),
		content: <FightGauge
			label={i18n.t("app:profile.fields.campaign")}
			value={profile.missions.campaignProgression}
			max={CAMPAIGN_COMPLETE}
			color={Theme.colors.gold}
			{...gaugeEmoji("missions.campaign")}
		/>
	};
}

function cookingSection(profile: ProfileRes): ProfileSection | null {
	if (!profile.cooking) {
		return null;
	}
	const {cooking} = profile;
	return {
		id: "cooking",
		icon: "city.homeUpgrades.cooking",
		label: i18n.t("app:profile.titles.cooking"),
		caption: i18n.t("app:profile.formats.cooking", {
			level: cooking.level,
			grade: i18n.t(`models:cooking.grades.${cooking.grade}`)
		}),
		content: <FightGauge
			label={i18n.t("app:profile.fields.experience")}
			value={cooking.experience.value}
			max={cooking.experience.max}
			color={Theme.colors.gold}
			{...gaugeEmoji("unitValues.xp")}
		/>
	};
}

function ProfileSections({profile}: {profile: ProfileRes}): ReactNode {
	const [expanded, setExpanded] = useState<string | undefined>(undefined);
	const sections = [statisticsSection(profile), rankingSection(profile), campaignSection(profile), cookingSection(profile)]
		.filter((section): section is ProfileSection => section !== null);
	return (
		<ExpandableList>
			{sections.map(section => <ExpandableEntry
				key={section.id}
				emblem={<TwemojiIcon emoji={AppIcons.getIcon(section.icon)} size={SECTION_EMBLEM_SIZE} />}
				label={section.label}
				caption={section.caption}
				expanded={expanded === section.id}
				onToggle={(): void => setExpanded(previous => previous === section.id ? undefined : section.id)}
				testID={`profile-${section.id}`}
			>{section.content}</ExpandableEntry>)}
		</ExpandableList>
	);
}

/** The company the player keeps, which lives in its own tab but is worth naming here. */
function Belongings({profile}: {profile: ProfileRes}): ReactNode {
	if (!profile.guild && !profile.pet) {
		return null;
	}
	return (
		<>
			<SectionHeader>{i18n.t("app:profile.titles.information")}</SectionHeader>
			<Panel>
				{profile.guild ? <KeyValue label={iconLabel("guild.icon", i18n.t("app:profile.fields.guild"))} value={profile.guild} /> : null}
				{profile.pet ? <KeyValue label={iconLabel("other.pet", i18n.t("app:profile.fields.pet"))} value={petLabel(profile)} /> : null}
			</Panel>
		</>
	);
}

function ProfileDetails({profile, onPage}: {profile: ProfileRes; onPage: (page: ProfilePage) => void}): ReactNode {
	return (
		<>
			<ProfileStanding profile={profile} />
			{shouldDisplayEffectTime(profile) ? <Note>{effectLabel(profile)}</Note> : null}
			<QuickActions>
				{PROFILE_PAGES.map(entry => <QuickAction key={entry.page} icon={AppIcons.getIcon(entry.icon)} onPress={(): void => onPage(entry.page)}>{i18n.t(`app:profile.titles.${entry.page}`)}</QuickAction>)}
			</QuickActions>
			<ProfileSections profile={profile} />
			<Belongings profile={profile} />
		</>
	);
}

function ProfileState({state, onPage}: {state: RequestState<ProfileRes>; onPage: (page: ProfilePage) => void}): ReactNode {
	if (state.status === "loading") {
		return (
			<View style={styles.state}>
				<ActivityIndicator size="large" color={Theme.colors.ink} />
				<EmptyState>{i18n.t("app:common.loading")}</EmptyState>
			</View>
		);
	}
	if (state.status === "empty" || state.status === "failed") {
		return <EmptyState>{state.status === "empty" ? i18n.t("app:profile.notFound") : i18n.t("app:common.error")}</EmptyState>;
	}
	return <ProfileDetails profile={state.data} onPage={onPage} />;
}

export default function Profile(): ReactNode {
	const profileState = usePlayerProfile();
	const navigation = useNavigation();
	const router = useRouter();
	const profile = profileState.status === "ready" ? profileState.data : null;

	useEffect(() => {
		if (profile) {
			navigation.setOptions({title: profile.pseudo});
		}
	}, [profile, navigation]);

	return <Screen><ProfileState state={profileState} onPage={(page): void => router.push(`/profile/${page}`)} /></Screen>;
}
