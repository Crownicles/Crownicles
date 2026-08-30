import {useNavigation} from "expo-router";
import {ReactNode, useEffect} from "react";
import {ActivityIndicator, StyleSheet, View} from "react-native";
import {GameClient} from "@/src/networking/GameClient";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {ProfileRes} from "ws-packets/src/fromServer/profile/ProfileRes";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {InventoryReq} from "ws-packets/src/fromClient/InventoryReq";
import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {Inventory, InventoryData} from "@/src/components/Inventory";
import {AppIcons} from "@/src/AppIcons";
import {
	EmptyState,
	Hero,
	KeyValue,
	Panel,
	Screen,
	SectionHeader,
	StatBar
} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {i18n} from "@/src/translations/i18n";
import {usePlayerProfile} from "@/src/store/usePlayerProfile";

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINIMUM_RATIO = 0;
const MAXIMUM_RATIO = 1;
const PET_RARITY_MIN = 0;
const PET_RARITY_MAX = 8;

const styles = StyleSheet.create({
	state: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: Theme.spacing.xxl
	},
	inventory: {
		marginTop: Theme.spacing.sectionGap
	}
});

function ratio(value: number, max: number): number {
	if (max <= 0) {
		return MINIMUM_RATIO;
	}
	return Math.min(MAXIMUM_RATIO, Math.max(MINIMUM_RATIO, value / max));
}

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
	const totalMinutes = Math.max(Math.ceil(milliseconds / MILLISECONDS_PER_MINUTE), MINIMUM_RATIO);
	const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
	if (hours > 0) {
		return i18n.t("app:adventure.duration.hoursMinutes", {
			hours,
			minutes: totalMinutes % MINUTES_PER_HOUR
		});
	}
	return i18n.t("app:adventure.duration.minutes", {minutes: totalMinutes});
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
	if (!shouldDisplayEffectTime(profile)) {
		return i18n.t("commands:profile.noTimeLeft.fieldValue");
	}
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

function ProfileInformation({profile}: {profile: ProfileRes}): ReactNode {
	return (
		<>
			<SectionHeader first>{i18n.t("app:profile.titles.information")}</SectionHeader>
			<Panel>
				<StatBar
					label={iconLabel("unitValues.health", i18n.t("app:profile.fields.health"))}
					value={progressValue(profile.health.value, profile.health.max)}
					ratio={ratio(profile.health.value, profile.health.max)}
					color={Theme.colors.red}
				/>
				<StatBar
					label={iconLabel("unitValues.xp", i18n.t("app:profile.fields.experience"))}
					value={progressValue(profile.experience.value, profile.experience.max)}
					ratio={ratio(profile.experience.value, profile.experience.max)}
					color={Theme.colors.gold}
				/>
				<KeyValue label={iconLabel("unitValues.money", i18n.t("app:profile.fields.money"))} value={numberValue(profile.money)} />
				{profile.tokens ? (
					<KeyValue
						label={iconLabel("unitValues.token", i18n.t("app:profile.fields.tokens"))}
						value={progressValue(profile.tokens.value, profile.tokens.max)}
					/>
				) : null}
			</Panel>
		</>
	);
}

function Statistics({profile}: {profile: ProfileRes}): ReactNode {
	if (!profile.stats) {
		return null;
	}
	const {stats} = profile;
	return (
		<>
			<SectionHeader>{i18n.t("app:profile.titles.statistics")}</SectionHeader>
			<Panel>
				<KeyValue label={iconLabel("unitValues.energy", i18n.t("app:profile.fields.energy"))} value={progressValue(stats.energy.value, stats.energy.max)} />
				<KeyValue label={iconLabel("unitValues.attack", i18n.t("app:profile.fields.attack"))} value={numberValue(stats.attack)} />
				<KeyValue label={iconLabel("unitValues.defense", i18n.t("app:profile.fields.defense"))} value={numberValue(stats.defense)} />
				<KeyValue label={iconLabel("unitValues.speed", i18n.t("app:profile.fields.speed"))} value={numberValue(stats.speed)} />
				<KeyValue label={iconLabel("unitValues.breath", i18n.t("app:profile.fields.breath"))} value={progressValue(stats.breath.base, stats.breath.max)} />
				<KeyValue label={iconLabel("unitValues.breathRegen", i18n.t("app:profile.fields.breathRegen"))} value={numberValue(stats.breath.regen)} />
			</Panel>
		</>
	);
}

function Missions({profile}: {profile: ProfileRes}): ReactNode {
	return (
		<>
			<SectionHeader>{i18n.t("app:profile.titles.missions")}</SectionHeader>
			<Panel>
				<KeyValue label={iconLabel("unitValues.gem", i18n.t("app:profile.fields.gems"))} value={numberValue(profile.missions.gems)} />
				<KeyValue label={iconLabel("missions.campaign", i18n.t("app:profile.fields.campaign"))} value={percentageValue(profile.missions.campaignProgression)} />
			</Panel>
		</>
	);
}

function ScoreAndRanking({profile}: {profile: ProfileRes}): ReactNode {
	const rank = profile.rank.unranked
		? i18n.t("app:profile.values.unranked")
		: i18n.t("app:profile.formats.rank", {rank: profile.rank.rank, players: profile.rank.numberOfPlayers});
	return (
		<>
			<SectionHeader>{i18n.t("app:profile.titles.scoreAndRank")}</SectionHeader>
			<Panel>
				<KeyValue label={iconLabel("announcements.trophy", i18n.t("app:profile.fields.rank"))} value={rank} />
				<KeyValue label={iconLabel("unitValues.score", i18n.t("app:profile.fields.score"))} value={numberValue(profile.rank.score)} />
			</Panel>
		</>
	);
}

function GloryAndLeague({profile}: {profile: ProfileRes}): ReactNode {
	if (!profile.fightRanking) {
		return null;
	}
	const {fightRanking} = profile;
	const rank = fightRanking.gloryRank === -1
		? i18n.t("app:profile.values.unranked")
		: i18n.t("app:profile.formats.rank", {
			rank: fightRanking.gloryRank,
			players: fightRanking.numberOfFighters
		});
	const leagueIcon = AppIcons.getIconOrNull(`leagues.${fightRanking.league}`);
	const leagueName = i18n.t(`models:leagues.${fightRanking.league}`);
	return (
		<>
			<SectionHeader>{i18n.t("app:profile.titles.gloryAndLeague")}</SectionHeader>
			<Panel>
				<KeyValue label={iconLabel("announcements.trophy", i18n.t("app:profile.fields.gloryRank"))} value={rank} />
				<KeyValue label={iconLabel("unitValues.glory", i18n.t("app:profile.fields.glory"))} value={numberValue(fightRanking.glory)} />
				<KeyValue label={`${leagueIcon ?? AppIcons.getIcon("announcements.trophy")} ${i18n.t("app:profile.fields.league")}`} value={leagueName} />
			</Panel>
		</>
	);
}

function AdditionalProfileSections({profile}: {profile: ProfileRes}): ReactNode {
	return (
		<>
			<SectionHeader>{i18n.t("app:profile.titles.status")}</SectionHeader>
			<Panel>
				<KeyValue label={iconLabel("effects.none", i18n.t("app:profile.fields.effect"))} value={effectLabel(profile)} />
			</Panel>
			{profile.cooking ? (
				<>
					<SectionHeader>{i18n.t("app:profile.titles.cooking")}</SectionHeader>
					<Panel>
						<KeyValue
							label={iconLabel("city.homeUpgrades.cooking", i18n.t("app:profile.fields.cooking"))}
							value={i18n.t("app:profile.formats.cooking", {
								level: profile.cooking.level,
								grade: i18n.t(`models:cooking.grades.${profile.cooking.grade}`)
							})}
						/>
						<StatBar
							label={iconLabel("unitValues.xp", i18n.t("app:profile.fields.experience"))}
							value={progressValue(profile.cooking.experience.value, profile.cooking.experience.max)}
							ratio={ratio(profile.cooking.experience.value, profile.cooking.experience.max)}
							color={Theme.colors.gold}
						/>
					</Panel>
				</>
			) : null}
			{profile.guild ? (
				<>
					<SectionHeader>{i18n.t("app:profile.titles.guild")}</SectionHeader>
					<Panel><KeyValue label={iconLabel("guild.icon", i18n.t("app:profile.fields.guild"))} value={profile.guild} /></Panel>
				</>
			) : null}
			{profile.destinationId !== undefined ? (
				<>
					<SectionHeader>{i18n.t("app:profile.titles.destination")}</SectionHeader>
					<Panel><KeyValue label={iconLabel("navigation.adventure", i18n.t("app:profile.fields.location"))} value={locationLabel(profile)} /></Panel>
				</>
			) : null}
			{profile.pet ? (
				<>
					<SectionHeader>{i18n.t("app:profile.titles.pet")}</SectionHeader>
					<Panel><KeyValue label={iconLabel("other.pet", i18n.t("app:profile.fields.pet"))} value={petLabel(profile)} /></Panel>
				</>
			) : null}
		</>
	);
}

function ProfileDetails({profile}: {profile: ProfileRes}): ReactNode {
	const subtitle = i18n.t("app:profile.subtitle", {
		className: classLabel(profile),
		level: profile.level,
		location: locationLabel(profile)
	});
	return (
		<>
			<Hero eyebrow={i18n.t("app:profile.eyebrow")} title={profile.pseudo} subtitle={subtitle} />
			<ProfileInformation profile={profile} />
			<Statistics profile={profile} />
			<Missions profile={profile} />
			<ScoreAndRanking profile={profile} />
			<GloryAndLeague profile={profile} />
			<AdditionalProfileSections profile={profile} />
		</>
	);
}

function ProfileState({state}: {state: RequestState<ProfileRes>}): ReactNode {
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
	return <ProfileDetails profile={state.data} />;
}

function InventorySection({state}: {state: RequestState<InventoryRes>}): ReactNode {
	const inventoryData: InventoryData | null = state.status === "ready" ? state.data.data ?? null : null;
	const emptyMessage = state.status === "failed"
		? i18n.t("app:common.error")
		: state.status === "ready"
			? i18n.t("app:profile.inventory.empty")
			: i18n.t("app:common.loading");
	return (
		<View style={styles.inventory}>
			<SectionHeader>{i18n.t("app:profile.titles.inventory")}</SectionHeader>
			{inventoryData ? <Inventory inventoryData={inventoryData} /> : <EmptyState>{emptyMessage}</EmptyState>}
		</View>
	);
}

export default function Profile(): ReactNode {
	const profileState = usePlayerProfile();
	const inventoryState = useGameQuery<InventoryRes>(
		GAME_ENTITIES.INVENTORY,
		() => GameClient.request(makeFromClientPacket(InventoryReq, {askedPlayer: {}}), InventoryRes, [PlayerNotFound])
	);
	const navigation = useNavigation();
	const profile = profileState.status === "ready" ? profileState.data : null;

	useEffect(() => {
		if (profile) {
			navigation.setOptions({title: profile.pseudo});
		}
	}, [profile, navigation]);

	return (
		<Screen>
			<ProfileState state={profileState} />
			{profileState.status === "ready" ? <InventorySection state={inventoryState} /> : null}
		</Screen>
	);
}
