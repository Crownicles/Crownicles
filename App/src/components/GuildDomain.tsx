import {ReactNode, useState} from "react";
import {Text, View} from "react-native";
import {useRouter} from "expo-router";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {FromClientPacket} from "ws-packets/src/fromClient/FromClientPacket";
import {GuildDomainInfoReq, GuildDomainUpgradeReq, GuildDomainFoodReq, GuildDomainDepositReq} from "ws-packets/src/fromClient/GuildDomainReq";
import {GuildDomainInfoRes, GuildDomainRes} from "ws-packets/src/fromServer/guild/GuildDomainRes";
import {PlayerNotFound} from "ws-packets/src/fromServer/common/PlayerNotFound";
import {GuildBuilding, GuildDomainSnapshot, GuildFoodShop, GuildDepositOffer} from "ws-packets/src/objects/GuildDomain";
import {PetFood} from "ws-packets/src/objects/PetFood";
import {GameClient} from "@/src/networking/GameClient";
import {GAME_ENTITIES} from "@/src/store/GameEntities";
import {useGameQuery} from "@/src/store/useGameQuery";
import {CommandMenu, useCommandMenus} from "@/src/store/useInventoryMenus";
import {GameQueryContent} from "@/src/components/GameQueryContent";
import {FightGauge} from "@/src/components/FightGauge";
import {gaugeEmoji} from "@/src/components/Guild";
import {Button, ButtonRow, Confirmation, Note, SectionHeader} from "@/src/design/Primitives";
import {EntryRow, ExpandableEntry, ExpandableList, Fact, Figures, sectionStyles, Standing} from "@/src/design/Sections";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {AppIcons} from "@/src/AppIcons";
import {formatMoney, formatNumber} from "@/src/display/Amounts";
import {petName, petMood, petIcon} from "@/src/display/PetDisplay";
import {i18n} from "@/src/translations/i18n";

const DOMAIN_MENUS = {
	upgrade: {request: GuildDomainUpgradeReq, emptyPacket: PlayerNotFound, emptyMessage: "app:guild.noGuild", outcomePackets: [GuildDomainRes]},
	food: {request: GuildDomainFoodReq, emptyPacket: PlayerNotFound, emptyMessage: "app:guild.noGuild", outcomePackets: [GuildDomainRes]},
	deposit: {request: GuildDomainDepositReq, emptyPacket: PlayerNotFound, emptyMessage: "app:guild.noGuild", outcomePackets: [GuildDomainRes]}
} satisfies Record<string, CommandMenu>;
type DomainSelection = {kind: keyof typeof DOMAIN_MENUS; request: FromClientPacket; title: string; message: string};
type DomainActions = {pending: boolean; select: (selection: DomainSelection) => void};
const BUILDING_LEVEL_FIELDS = {
	[GuildBuilding.SHOP]: "shopLevel", [GuildBuilding.SHELTER]: "shelterLevel",
	[GuildBuilding.PANTRY]: "pantryLevel", [GuildBuilding.TRAINING_GROUND]: "trainingGroundLevel"
} as const;
const FOOD_FIELDS = {
	[PetFood.CANDY]: "common", [PetFood.SALAD]: "herbivorous", [PetFood.MEAT]: "carnivorous", [PetFood.ULTIMATE]: "ultimate"
} as const;

function BuildingUpgrade({domain, building, actions}: {domain: GuildDomainSnapshot; building: GuildBuilding; actions: DomainActions}): ReactNode {
	const upgrade = domain.canUpgradeBuildings[building];
	if (!upgrade) return <Note>{i18n.t("app:guildDomain.maxLevel")}</Note>;
	const restrictions = [!domain.isInCity, !domain.isChief, !upgrade.meetsLevel, !upgrade.canAfford];
	return <>
		<SectionHeader>{i18n.t("app:guildDomain.upgrade")}</SectionHeader>
		<ExpandableList>
			<Fact label={i18n.t("app:guildDomain.cost")} value={formatMoney(upgrade.cost)} />
			<Fact label={i18n.t("app:guildDomain.requiredLevel")} value={formatNumber(upgrade.requiredGuildLevel)} />
		</ExpandableList>
		<ButtonRow><Button disabled={actions.pending || restrictions.some(Boolean)} onPress={(): void => actions.select({kind: "upgrade", request: makeFromClientPacket(GuildDomainUpgradeReq, {building, expectedLevel: domain[BUILDING_LEVEL_FIELDS[building]]}), title: i18n.t("app:guildDomain.upgrade"), message: i18n.t("app:guildDomain.confirmUpgrade", {building: i18n.t(`commands:report.city.guildDomain.buildings.${building}`), cost: formatMoney(upgrade.cost)})})}>{i18n.t("app:guildDomain.upgrade")}</Button></ButtonRow>
	</>;
}

function GuildFoodLine({data, foodType, index, actions}: {data: GuildFoodShop; foodType: PetFood; index: number; actions: DomainActions}): ReactNode {
	const name = i18n.t(`models:foods.${foodType}`, {count: 1, context: "capitalized"});
	const buy = (amount: number, cost: number): void => actions.select({kind: "food", request: makeFromClientPacket(GuildDomainFoodReq, {foodType, amount}), title: name, message: i18n.t("app:guildDomain.confirmFood", {count: amount, cost: formatMoney(cost)})});
	const disabled = actions.pending || !data.canUseShop || data.maxBuyableFood[index] < 1;
	return <>
		<SectionHeader>{name}</SectionHeader>
		<ExpandableList>
			<Fact label={i18n.t("app:guildDomain.stock")} value={i18n.t("app:profile.formats.progress", {value: data.food[FOOD_FIELDS[foodType]], max: data.foodCaps[index]})} />
			<Fact label={i18n.t("app:pet.care.price")} value={formatMoney(data.foodPrices[index])} />
		</ExpandableList>
		<ButtonRow>
			<Button disabled={disabled} onPress={(): void => buy(1, data.foodPrices[index])}>{i18n.t("app:guildDomain.buyOne")}</Button>
			<Button disabled={disabled} onPress={(): void => buy(data.maxBuyableFood[index], data.maxFoodCosts[index])}>{i18n.t("app:guildDomain.buyMax", {count: data.maxBuyableFood[index]})}</Button>
		</ButtonRow>
	</>;
}

function DomainDeposits({domain, actions}: {domain: GuildDomainSnapshot; actions: DomainActions}): ReactNode {
	const deposit = (offer: GuildDepositOffer): void => actions.select({kind: "deposit", request: makeFromClientPacket(GuildDomainDepositReq, {amount: offer.amount}), title: i18n.t("app:guildDomain.deposit"), message: i18n.t("app:guildDomain.confirmDeposit", {amount: formatMoney(offer.amount), net: formatMoney(offer.treasuryDeposited)})});
	return <>
		<SectionHeader>{i18n.t("app:guildDomain.deposit")}</SectionHeader>
		<ExpandableList>{domain.depositOffers.map(offer => <EntryRow key={offer.amount} title={formatMoney(offer.amount)} subtitle={i18n.t("app:guildDomain.depositNet", {net: formatMoney(offer.treasuryDeposited)})} disabled={actions.pending || !offer.canAfford || !domain.isInCity} onPress={(): void => deposit(offer)}  />)}</ExpandableList>
	</>;
}

function BuildingContents({domain, building, actions}: {domain: GuildDomainSnapshot; building: GuildBuilding; actions: DomainActions}): ReactNode {
	switch (building) {
		case GuildBuilding.SHOP:
			return <>{Object.values(PetFood).map((foodType, index) => <GuildFoodLine key={foodType} data={domain} foodType={foodType} index={index} actions={actions} />)}</>;
		case GuildBuilding.SHELTER:
			return <ExpandableList>
				<Fact label={i18n.t("app:guildDomain.capacity")} value={i18n.t("app:profile.formats.progress", {value: domain.shelterPets.length, max: domain.shelterMaxCount})} />
				{domain.shelterPets.map(pet => <EntryRow key={pet.petEntityId} title={`${petIcon(pet)} ${petName(pet)}`} subtitle={petMood(pet)} />)}
			</ExpandableList>;
		case GuildBuilding.PANTRY:
			return <>{Object.values(PetFood).map((foodType, index) => <View key={foodType} style={sectionStyles.gauge}>
				<FightGauge
					label={i18n.t(`models:foods.${foodType}`, {count: domain.food[FOOD_FIELDS[foodType]], context: "capitalized"})}
					value={domain.food[FOOD_FIELDS[foodType]]}
					max={domain.foodCaps[index]}
					color={Theme.colors.gold}
					{...gaugeEmoji(`foods.${foodType}`)}
				/>
				<Note>{i18n.t("app:guildDomain.production", {count: domain.dailyFoodProduction[index]})}</Note>
			</View>)}</>;
		default:
			return <Note>{i18n.t("app:guildDomain.training", {count: domain.dailyLovePoints})}</Note>;
	}
}

type BuildingEntryProps = {domain: GuildDomainSnapshot; building: GuildBuilding; actions: DomainActions; expanded: boolean; onSelect: (building: GuildBuilding) => void; onTransfer: () => void};

function BuildingEntry({domain, building, actions, expanded, onSelect, onTransfer}: BuildingEntryProps): ReactNode {
	const icon = AppIcons.getIconOrNull(`city.guildDomain.${building}`);
	return <ExpandableEntry
		emblem={icon ? <TwemojiIcon emoji={icon} size={22} /> : null}
		label={i18n.t(`commands:report.city.guildDomain.buildings.${building}`)}
		end={<Text style={sectionStyles.caption}>{i18n.t("app:guild.level", {level: domain[BUILDING_LEVEL_FIELDS[building]]})}</Text>}
		expanded={expanded}
		onToggle={(): void => onSelect(building)}
	>
		<BuildingContents domain={domain} building={building} actions={actions} />
		{building === GuildBuilding.SHELTER ? <ButtonRow><Button onPress={onTransfer}>{i18n.t("app:pet.management.shelter")}</Button></ButtonRow> : null}
		<BuildingUpgrade domain={domain} building={building} actions={actions} />
	</ExpandableEntry>;
}

function DomainStanding({domain}: {domain: GuildDomainSnapshot}): ReactNode {
	const icon = AppIcons.getIconOrNull("city.guildDomain.menu");
	return <Standing
		testID="domain-standing"
		emblem={icon ? <TwemojiIcon emoji={icon} size={40} /> : null}
		caption={i18n.t("app:guild.pages.domain")}
		title={domain.guildName}
		subtitle={domain.domainMapLocationId === undefined
			? i18n.t("app:guild.level", {level: domain.guildLevel})
			: i18n.t(`models:map_locations.${domain.domainMapLocationId}.name`)}
	>
		<Figures items={[
			{caption: i18n.t("app:city.summary.treasury"), value: formatNumber(domain.treasury), unit: "money"},
			{caption: i18n.t("app:guild.yourMoney"), value: formatNumber(domain.playerMoney), unit: "money"}
		]} />
	</Standing>;
}

export function GuildDomainContent({domain}: {domain: GuildDomainSnapshot}): ReactNode {
	const [building, setBuilding] = useState<GuildBuilding | null>(null);
	const [selection, setSelection] = useState<DomainSelection | null>(null);
	const {pending, message, open} = useCommandMenus();
	const router = useRouter();
	const actions = {pending, select: setSelection};
	const confirm = (): void => {
		if (!selection || pending) return;
		setSelection(null);
		open(DOMAIN_MENUS[selection.kind], selection.request).catch(console.error);
	};
	return <>
		<DomainStanding domain={domain} />
		{message ? <Note>{message}</Note> : null}
		<SectionHeader>{i18n.t("app:guildDomain.buildings")}</SectionHeader>
		<ExpandableList>{Object.values(GuildBuilding).map(value => <BuildingEntry
			key={value}
			domain={domain}
			building={value}
			actions={actions}
			expanded={building === value}
			onSelect={(selected): void => setBuilding(current => current === selected ? null : selected)}
			onTransfer={(): void => router.push("/guild/shelter")}
		/>)}</ExpandableList>
		<DomainDeposits domain={domain} actions={actions} />
		{selection ? <Confirmation title={selection.title} message={selection.message} onRequestClose={(): void => setSelection(null)}>
			<ButtonRow><Button variant="primary" disabled={pending} onPress={confirm}>{i18n.t("app:collector.accept")}</Button><Button onPress={(): void => setSelection(null)}>{i18n.t("app:collector.refuse")}</Button></ButtonRow>
		</Confirmation> : null}
	</>;
}

export function GuildDomain(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.GUILD_DOMAIN, () => GameClient.request(makeFromClientPacket(GuildDomainInfoReq, {}), GuildDomainInfoRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.GUILD_DOMAIN}>{packet => packet.data ? <GuildDomainContent domain={packet.data} /> : <Note>{i18n.t("app:guild.noGuild")}</Note>}</GameQueryContent>;
}
