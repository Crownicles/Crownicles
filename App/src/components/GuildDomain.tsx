import {ReactNode, useState} from "react";
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
import {PET_MANAGEMENT_MENUS} from "@/src/components/PetManagement";
import {Button, ButtonRow, Confirmation, KeyValue, Note, Panel, Row, SectionHeader} from "@/src/design/Primitives";
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
		<Panel>
			<KeyValue label={i18n.t("app:guildDomain.cost")} value={formatMoney(upgrade.cost)} />
			<KeyValue label={i18n.t("app:guildDomain.requiredLevel")} value={formatNumber(upgrade.requiredGuildLevel)} />
		</Panel>
		<ButtonRow><Button disabled={actions.pending || restrictions.some(Boolean)} onPress={(): void => actions.select({kind: "upgrade", request: makeFromClientPacket(GuildDomainUpgradeReq, {building, expectedLevel: domain[BUILDING_LEVEL_FIELDS[building]]}), title: i18n.t("app:guildDomain.upgrade"), message: i18n.t("app:guildDomain.confirmUpgrade", {building: i18n.t(`commands:report.city.guildDomain.buildings.${building}`), cost: formatMoney(upgrade.cost)})})}>{i18n.t("app:guildDomain.upgrade")}</Button></ButtonRow>
	</>;
}

function GuildFoodLine({data, foodType, index, actions}: {data: GuildFoodShop; foodType: PetFood; index: number; actions: DomainActions}): ReactNode {
	const name = i18n.t(`models:foods.${foodType}`, {count: 1, context: "capitalized"});
	const buy = (amount: number, cost: number): void => actions.select({kind: "food", request: makeFromClientPacket(GuildDomainFoodReq, {foodType, amount}), title: name, message: i18n.t("app:guildDomain.confirmFood", {count: amount, cost: formatMoney(cost)})});
	const disabled = actions.pending || !data.canUseShop || data.maxBuyableFood[index] < 1;
	return <>
		<SectionHeader>{name}</SectionHeader>
		<Panel>
			<KeyValue label={i18n.t("app:guildDomain.stock")} value={i18n.t("app:profile.formats.progress", {value: data.food[FOOD_FIELDS[foodType]], max: data.foodCaps[index]})} />
			<KeyValue label={i18n.t("app:pet.care.price")} value={formatMoney(data.foodPrices[index])} />
		</Panel>
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
		<Panel>{domain.depositOffers.map(offer => <Row key={offer.amount} title={formatMoney(offer.amount)} subtitle={i18n.t("app:guildDomain.depositNet", {net: formatMoney(offer.treasuryDeposited)})} disabled={actions.pending || !offer.canAfford || !domain.isInCity} onPress={(): void => deposit(offer)} chevron />)}</Panel>
	</>;
}

function BuildingContents({domain, building, actions}: {domain: GuildDomainSnapshot; building: GuildBuilding; actions: DomainActions}): ReactNode {
	switch (building) {
		case GuildBuilding.SHOP:
			return <>{Object.values(PetFood).map((foodType, index) => <GuildFoodLine key={foodType} data={domain} foodType={foodType} index={index} actions={actions} />)}<DomainDeposits domain={domain} actions={actions} /></>;
		case GuildBuilding.SHELTER:
			return <Panel>
				<KeyValue label={i18n.t("app:guildDomain.capacity")} value={i18n.t("app:profile.formats.progress", {value: domain.shelterPets.length, max: domain.shelterMaxCount})} />
				{domain.shelterPets.map(pet => <Row key={pet.petEntityId} title={`${petIcon(pet)} ${petName(pet)}`} subtitle={petMood(pet)} />)}
			</Panel>;
		case GuildBuilding.PANTRY:
			return <>{Object.values(PetFood).map((foodType, index) => <Panel key={foodType}>
				<KeyValue label={i18n.t(`models:foods.${foodType}`, {count: domain.food[FOOD_FIELDS[foodType]], context: "capitalized"})} value={i18n.t("app:profile.formats.progress", {value: domain.food[FOOD_FIELDS[foodType]], max: domain.foodCaps[index]})} />
				<KeyValue label={i18n.t("app:guildDomain.dailyProduction")} value={i18n.t("app:guildDomain.production", {count: domain.dailyFoodProduction[index]})} />
			</Panel>)}</>;
		default:
			return <Note>{i18n.t("app:guildDomain.training", {count: domain.dailyLovePoints})}</Note>;
	}
}

function DomainSummary({domain}: {domain: GuildDomainSnapshot}): ReactNode {
	return <>
		<Panel>
			<KeyValue label={i18n.t("app:city.summary.guild")} value={domain.guildName} />
			<KeyValue label={i18n.t("app:city.summary.treasury")} value={formatMoney(domain.treasury)} />
			{domain.domainMapLocationId ? <KeyValue label={i18n.t("app:guildDomain.location")} value={i18n.t(`models:map_locations.${domain.domainMapLocationId}.name`)} /> : null}
		</Panel>
		{!domain.domainCityId ? <Note>{i18n.t("app:guildDomain.noDomain")}</Note> : null}
		{!domain.isInCity ? <Note>{i18n.t("app:guildDomain.remote")}</Note> : null}
	</>;
}

export function GuildDomainContent({domain}: {domain: GuildDomainSnapshot}): ReactNode {
	const [building, setBuilding] = useState<GuildBuilding | null>(null);
	const [selection, setSelection] = useState<DomainSelection | null>(null);
	const {pending, message, open} = useCommandMenus();
	const actions = {pending, select: setSelection};
	const confirm = (): void => {
		if (!selection || pending) return;
		setSelection(null);
		open(DOMAIN_MENUS[selection.kind], selection.request).catch(console.error);
	};
	return <>
		<DomainSummary domain={domain} />
		{message ? <Note>{message}</Note> : null}
		{building ? <>
			<SectionHeader>{i18n.t(`commands:report.city.guildDomain.buildings.${building}`)}</SectionHeader>
			<Note>{i18n.t("app:guild.level", {level: domain[BUILDING_LEVEL_FIELDS[building]]})}</Note>
			<BuildingContents domain={domain} building={building} actions={actions} />
			{building === GuildBuilding.SHELTER ? <ButtonRow><Button disabled={pending} onPress={(): Promise<void> => open(PET_MANAGEMENT_MENUS.TRANSFER)}>{i18n.t("app:pet.management.transfer")}</Button></ButtonRow> : null}
			<BuildingUpgrade domain={domain} building={building} actions={actions} />
			<ButtonRow><Button onPress={(): void => setBuilding(null)}>{i18n.t("app:guildDomain.backToBuildings")}</Button></ButtonRow>
		</> : <>
			<SectionHeader>{i18n.t("app:guildDomain.buildings")}</SectionHeader>
			<Panel>{Object.values(GuildBuilding).map(value => <Row key={value} title={`${AppIcons.getIcon(`city.guildDomain.${value}`)} ${i18n.t(`commands:report.city.guildDomain.buildings.${value}`)}`} end={i18n.t("app:guild.level", {level: domain[BUILDING_LEVEL_FIELDS[value]]})} onPress={(): void => setBuilding(value)} chevron />)}</Panel>
			<DomainDeposits domain={domain} actions={actions} />
		</>}
		{selection ? <Confirmation title={selection.title} message={selection.message} onRequestClose={(): void => setSelection(null)}>
			<ButtonRow><Button variant="primary" disabled={pending} onPress={confirm}>{i18n.t("app:collector.accept")}</Button><Button onPress={(): void => setSelection(null)}>{i18n.t("app:collector.refuse")}</Button></ButtonRow>
		</Confirmation> : null}
	</>;
}

export function GuildDomain(): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.GUILD_DOMAIN, () => GameClient.request(makeFromClientPacket(GuildDomainInfoReq, {}), GuildDomainInfoRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.GUILD_DOMAIN}>{packet => packet.data ? <GuildDomainContent domain={packet.data} /> : <Note>{i18n.t("app:guild.noGuild")}</Note>}</GameQueryContent>;
}
