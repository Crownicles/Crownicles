import {
	ReactNode, useRef, useState
} from "react";
import {
	Text, View
} from "react-native";
import { useRouter } from "expo-router";
import { makeFromClientPacket } from "ws-packets/src/MakePackets";
import { FromClientPacket } from "ws-packets/src/fromClient/FromClientPacket";
import {
	GuildDomainInfoReq, GuildDomainUpgradeReq, GuildDomainFoodReq, GuildDomainDepositReq
} from "ws-packets/src/fromClient/GuildDomainReq";
import {
	GuildDomainInfoRes, GuildDomainRes
} from "ws-packets/src/fromServer/guild/GuildDomainRes";
import { PlayerNotFound } from "ws-packets/src/fromServer/common/PlayerNotFound";
import {
	GuildBuilding, GuildDomainSnapshot, GuildFoodShop, GuildDepositOffer
} from "ws-packets/src/objects/GuildDomain";
import { PetFood } from "ws-packets/src/objects/PetFood";
import { GameClient } from "@/src/networking/GameClient";
import { GAME_ENTITIES } from "@/src/store/GameEntities";
import { useGameQuery } from "@/src/store/useGameQuery";
import {
	CommandMenu, useCommandMenus
} from "@/src/store/useInventoryMenus";
import { GameQueryContent } from "@/src/components/GameQueryContent";
import { FightGauge } from "@/src/components/FightGauge";
import { gaugeEmoji } from "@/src/components/Guild";
import {
	Button, ButtonRow, Note, SectionHeader
} from "@/src/design/Primitives";
import {
	ActionBanner, EntryRow, ExpandableEntry, ExpandableList, Fact, Figures, Lock, LockHint, Refusal, useSectionStyles, Standing
} from "@/src/design/Sections";
import { Check } from "@/src/design/FightIcons";
import { TwemojiIcon } from "@/src/design/TwemojiIcon";
import { AppIcons } from "@/src/AppIcons";
import {
	formatMoney, formatNumber
} from "@/src/display/Amounts";
import {
	petName, petMood, petIcon
} from "@/src/display/PetDisplay";
import { i18n } from "@/src/translations/i18n";
import { useColors } from "@/src/design/ThemeContext";
import { domainPacketRefusal } from "@/src/collectors/GuildDomainOutcome";
import { useCollectors } from "@/src/collectors/CollectorsContext";
import { CollectorDecision } from "@/src/collectors/CollectorPrompt";
import { GUILD_DATA_KINDS } from "ws-packets/src/fromServer/collectors";
import { AppConstants } from "@/src/AppConstants";

const DOMAIN_MENUS = {
	upgrade: {
		request: GuildDomainUpgradeReq, emptyPacket: PlayerNotFound, emptyMessage: "app:guild.noGuild", outcomePackets: [GuildDomainRes], refusal: domainPacketRefusal
	},
	food: {
		request: GuildDomainFoodReq, emptyPacket: PlayerNotFound, emptyMessage: "app:guild.noGuild", outcomePackets: [GuildDomainRes], refusal: domainPacketRefusal
	},
	deposit: {
		request: GuildDomainDepositReq, emptyPacket: PlayerNotFound, emptyMessage: "app:guild.noGuild", outcomePackets: [GuildDomainRes], refusal: domainPacketRefusal
	}
} satisfies Record<string, CommandMenu>;
type DomainRequest = {
	kind: keyof typeof DOMAIN_MENUS; request: FromClientPacket;
};
type DomainActions = {
	pending: boolean; run: (action: DomainRequest) => void;
};
const BUILDING_LEVEL_FIELDS = {
	[GuildBuilding.SHOP]: "shopLevel",
	[GuildBuilding.SHELTER]: "shelterLevel",
	[GuildBuilding.PANTRY]: "pantryLevel",
	[GuildBuilding.TRAINING_GROUND]: "trainingGroundLevel",
	[GuildBuilding.RECRUITMENT_OFFICE]: "recruitmentOfficeLevel"
} as const;
const FOOD_FIELDS = {
	[PetFood.CANDY]: "common", [PetFood.SALAD]: "herbivorous", [PetFood.MEAT]: "carnivorous", [PetFood.ULTIMATE]: "ultimate"
} as const;

/** The first reason that stands in the way, so a greyed action always says why. */
function firstLock(reasons: {
	blocked: boolean; key: string;
}[]): Lock | undefined {
	const reason = reasons.find(entry => entry.blocked);
	return reason ? { reason: i18n.t(`app:guildDomain.errors.${reason.key}`) } : undefined;
}

function BuildingUpgrade({
	domain, building, actions
}: {
	domain: GuildDomainSnapshot; building: GuildBuilding; actions: DomainActions;
}): ReactNode {
	const upgrade = domain.canUpgradeBuildings[building];
	if (!upgrade) {
		return <Note>{i18n.t("app:guildDomain.maxLevel")}</Note>;
	}
	const lock = firstLock([
		{
			blocked: !domain.isInCity, key: "notInCity"
		},
		{
			blocked: !domain.isChief, key: "notAuthorized"
		},
		{
			blocked: !upgrade.meetsLevel, key: "guildLevelTooLow"
		},
		{
			blocked: !upgrade.canAfford, key: "notEnoughTreasury"
		}
	]);
	return <>
		<SectionHeader>{i18n.t("app:guildDomain.upgrade")}</SectionHeader>
		<ExpandableList>
			<Fact label={i18n.t("app:guildDomain.cost")} value={formatMoney(upgrade.cost)} />
			<Fact label={i18n.t("app:guildDomain.requiredLevel")} value={formatNumber(upgrade.requiredGuildLevel)} />
		</ExpandableList>
		<ActionBanner
			icon={Check}
			label={i18n.t("app:guildDomain.confirmUpgrade", {
				building: i18n.t(`commands:report.city.guildDomain.buildings.${building}`), cost: formatMoney(upgrade.cost)
			})}
			pending={actions.pending}
			{...lock ? { lock } : {}}
			onPress={(): void => actions.run({
				kind: "upgrade",
				request: makeFromClientPacket(GuildDomainUpgradeReq, {
					building, expectedLevel: domain[BUILDING_LEVEL_FIELDS[building]]
				})
			})}
		/>
	</>;
}

/** The quantities offered for a food: the quick amounts that still fit, then whatever fills the storage. */
function foodAmounts(maxBuyable: number): number[] {
	return [...new Set([...AppConstants.GUILD_FOOD_QUICK_AMOUNTS.map(amount => Math.min(amount, maxBuyable)), maxBuyable])].filter(amount => amount > 0);
}

/** Why no quantity of this food can be bought: the shop, a full storage or an empty treasury. */
function foodLock(data: GuildFoodShop, foodType: PetFood, index: number): Lock | undefined {
	return firstLock([
		{
			blocked: !data.canUseShop, key: "noShop"
		},
		{
			blocked: data.food[FOOD_FIELDS[foodType]] >= data.foodCaps[index], key: "storageFull"
		},
		{
			blocked: data.maxBuyableFood[index] < 1, key: "notEnoughTreasury"
		}
	]);
}

/** One button per quantity, each saying how many and what it costs: the rest is on the line above. */
function GuildFoodLine({
	data, foodType, index, actions
}: {
	data: GuildFoodShop; foodType: PetFood; index: number; actions: DomainActions;
}): ReactNode {
	const name = i18n.t(`models:foods.${foodType}`, {
		count: 1, context: "capitalized"
	});
	const lock = foodLock(data, foodType, index);
	const foodIcon = AppIcons.getIconOrNull(`foods.${foodType}`);
	const maxBuyable = data.maxBuyableFood[index];
	const buy = (amount: number): void => actions.run({
		kind: "food",
		request: makeFromClientPacket(GuildDomainFoodReq, {
			foodType, amount
		})
	});
	return <>
		<SectionHeader {...foodIcon ? { icon: foodIcon } : {}}>{name}</SectionHeader>
		<Note>{i18n.t(`app:guildDomain.foodDescriptions.${foodType}`)}</Note>
		<ExpandableList>
			<Fact label={i18n.t("app:guildDomain.stock")} value={i18n.t("app:profile.formats.progress", {
				value: data.food[FOOD_FIELDS[foodType]], max: data.foodCaps[index]
			})} />
			<Fact label={i18n.t("app:guildDomain.unitPrice")} value={formatMoney(data.foodPrices[index])} />
		</ExpandableList>
		{lock
			? <LockHint lock={lock} />
			: <ButtonRow>{foodAmounts(maxBuyable).map(amount => <Button
				key={amount}
				variant="primary"
				disabled={actions.pending}
				onPress={(): void => buy(amount)}
			>{i18n.t("app:guildDomain.buyFood", {
					amount: formatNumber(amount), cost: formatMoney(amount === maxBuyable ? data.maxFoodCosts[index] : data.foodPrices[index] * amount)
				})}</Button>)}</ButtonRow>}
	</>;
}

/** Every food the shop sells, with its stock, its price and the quantities the treasury can still pay for. */
function GuildFoodLines({
	shop, actions
}: {
	shop: GuildFoodShop; actions: DomainActions;
}): ReactNode {
	return Object.values(PetFood).map((foodType, index) => <GuildFoodLine key={foodType} data={shop} foodType={foodType} index={index} actions={actions} />);
}

/**
 * The treasury paid for the food: the player may refund it from their own purse. Asked in place, where the
 * purchase was made, since the shop already holds the screen and no second window may open on top of it.
 */
function ReimburseOffer(): ReactNode {
	const {
		open, react, isAnswerPending
	} = useCollectors();
	const collector = open.find(candidate => candidate.data.type === GUILD_DATA_KINDS.REIMBURSE);
	if (!collector || collector.data.type !== GUILD_DATA_KINDS.REIMBURSE) {
		return null;
	}
	const amount = formatMoney(collector.data.data.amount);
	return <>
		<SectionHeader>{i18n.t("app:guildDomain.outcomes.food")}</SectionHeader>
		<Note>{i18n.t("app:guildDomain.confirmReimburse", { amount })}</Note>
		<CollectorDecision
			collector={collector}
			onChoose={(reactionIndex): void => react(collector.id, reactionIndex)}
			submitting={isAnswerPending(collector.id)}
			acceptLabel={i18n.t("app:guildDomain.reimburseAccept", { amount })}
			cancelLabel={i18n.t("app:guildDomain.reimburseDecline")}
		/>
	</>;
}

function DepositOffer({
	offer, domain, actions, expanded, onToggle
}: {
	offer: GuildDepositOffer; domain: GuildDomainSnapshot; actions: DomainActions; expanded: boolean; onToggle: () => void;
}): ReactNode {
	const lock = firstLock([
		{
			blocked: !domain.isInCity, key: "notInCity"
		}, {
			blocked: !offer.canAfford, key: "notEnoughMoney"
		}
	]);
	return <ExpandableEntry
		label={formatMoney(offer.amount)}
		caption={lock?.reason ?? i18n.t("app:guildDomain.depositNet", { net: formatMoney(offer.treasuryDeposited) })}
		dimmed={actions.pending || Boolean(lock)}
		expanded={expanded}
		onToggle={onToggle}
	>
		<ActionBanner
			icon={Check}
			label={i18n.t("app:guildDomain.confirmDeposit", {
				amount: formatMoney(offer.amount), net: formatMoney(offer.treasuryDeposited)
			})}
			pending={actions.pending}
			{...lock ? { lock } : {}}
			onPress={(): void => {
				onToggle();
				actions.run({
					kind: "deposit", request: makeFromClientPacket(GuildDomainDepositReq, { amount: offer.amount })
				});
			}}
		/>
	</ExpandableEntry>;
}

function DomainDeposits({
	domain, actions, openAmount, onOpen
}: {
	domain: GuildDomainSnapshot; actions: DomainActions; openAmount: number | undefined; onOpen: (amount: number | undefined) => void;
}): ReactNode {
	return <>
		<SectionHeader>{i18n.t("app:guildDomain.deposit")}</SectionHeader>
		<ExpandableList>{domain.depositOffers.map(offer => <DepositOffer
			key={offer.amount}
			offer={offer}
			domain={domain}
			actions={actions}
			expanded={openAmount === offer.amount}
			onToggle={(): void => onOpen(openAmount === offer.amount ? undefined : offer.amount)}
		/>)}</ExpandableList>
	</>;
}

function recruitmentOfficeNote(domain: GuildDomainSnapshot): string {
	if (domain.recruitmentOfficeLevel === 0) {
		return i18n.t("app:guildDomain.recruitment.locked");
	}
	return domain.recruitment.open
		? i18n.t("app:guildDomain.recruitment.open", { minScore: formatNumber(domain.recruitment.minScore) })
		: i18n.t("app:guildDomain.recruitment.closed");
}

function BuildingContents({
	domain, building, actions
}: {
	domain: GuildDomainSnapshot; building: GuildBuilding; actions: DomainActions;
}): ReactNode {
	const sectionStyles = useSectionStyles();
	const colors = useColors();
	switch (building) {
		case GuildBuilding.SHOP:
			return <>
				<ReimburseOffer />
				<GuildFoodLines shop={domain} actions={actions} />
			</>;
		case GuildBuilding.SHELTER:
			return <ExpandableList>
				<Fact label={i18n.t("app:guildDomain.capacity")} value={i18n.t("app:profile.formats.progress", {
					value: domain.shelterPets.length, max: domain.shelterMaxCount
				})} />
				{domain.shelterPets.map(pet => <EntryRow key={pet.petEntityId} title={`${petIcon(pet)} ${petName(pet)}`} subtitle={petMood(pet)} />)}
			</ExpandableList>;
		case GuildBuilding.PANTRY:
			return <>{Object.values(PetFood).map((foodType, index) => <View key={foodType} style={sectionStyles.gauge}>
				<FightGauge
					label={i18n.t(`models:foods.${foodType}`, {
						count: domain.food[FOOD_FIELDS[foodType]], context: "capitalized"
					})}
					value={domain.food[FOOD_FIELDS[foodType]]}
					max={domain.foodCaps[index]}
					color={colors.gold}
					{...gaugeEmoji(`foods.${foodType}`)}
				/>
				<Note>{i18n.t("app:guildDomain.production", { count: domain.dailyFoodProduction[index] })}</Note>
			</View>)}</>;
		case GuildBuilding.RECRUITMENT_OFFICE:
			return <Note>{recruitmentOfficeNote(domain)}</Note>;
		default:
			return <Note>{i18n.t("app:guildDomain.training", { count: domain.dailyLovePoints })}</Note>;
	}
}

type BuildingEntryProps = {
	domain: GuildDomainSnapshot; building: GuildBuilding; actions: DomainActions; expanded: boolean; onSelect: (building: GuildBuilding) => void; onTransfer: () => void;
};

function BuildingEntry({
	domain, building, actions, expanded, onSelect, onTransfer
}: BuildingEntryProps): ReactNode {
	const sectionStyles = useSectionStyles();
	const icon = AppIcons.getIconOrNull(`city.guildDomain.${building}`);

	// The shelter page opens once the building sheet is put away, so it never piles up under it.
	const transferRequested = useRef(false);
	return <ExpandableEntry
		emblem={icon ? <TwemojiIcon emoji={icon} size={22} /> : null}
		label={i18n.t(`commands:report.city.guildDomain.buildings.${building}`)}
		end={<Text style={sectionStyles.caption}>{i18n.t("app:guild.level", { level: domain[BUILDING_LEVEL_FIELDS[building]] })}</Text>}
		expanded={expanded}
		onToggle={(): void => onSelect(building)}
		onDismissed={(): void => {
			if (transferRequested.current) {
				transferRequested.current = false;
				onTransfer();
			}
		}}
	>
		<BuildingContents domain={domain} building={building} actions={actions} />
		{building === GuildBuilding.SHELTER
			? <ButtonRow><Button onPress={(): void => {
				transferRequested.current = true;
				onSelect(building);
			}}>{i18n.t("app:pet.management.shelter")}</Button></ButtonRow>
			: null}
		<BuildingUpgrade domain={domain} building={building} actions={actions} />
	</ExpandableEntry>;
}

/** What the food is paid with: the guild's treasury, and the player's own purse that may refund it. */
function TreasuryFigures({ shop }: { shop: GuildFoodShop }): ReactNode {
	return <Figures items={[
		{
			caption: i18n.t("app:city.summary.treasury"), value: formatNumber(shop.treasury), unit: "money"
		},
		{
			caption: i18n.t("app:guild.yourMoney"), value: formatNumber(shop.playerMoney), unit: "money"
		}
	]} />;
}

function DomainStanding({ domain }: { domain: GuildDomainSnapshot }): ReactNode {
	const icon = AppIcons.getIconOrNull("city.guildDomain.menu");
	return <Standing
		testID="domain-standing"
		emblem={icon ? <TwemojiIcon emoji={icon} size={40} /> : null}
		caption={i18n.t("app:guild.pages.domain")}
		title={domain.guildName}
		subtitle={domain.domainMapLocationId === undefined
			? i18n.t("app:guild.level", { level: domain.guildLevel })
			: i18n.t(`models:map_locations.${domain.domainMapLocationId}.name`)}
	>
		<TreasuryFigures shop={domain} />
	</Standing>;
}

type DomainCommands = {
	actions: DomainActions; message: string | null;
};

/** One domain request at a time, and the refusal Core answered, shown where the request was made. */
function useDomainCommands(): DomainCommands {
	const {
		pending, message, open
	} = useCommandMenus();
	return {
		message,
		actions: {
			pending,
			run: (action: DomainRequest): void => {
				if (pending) {
					return;
				}
				open(DOMAIN_MENUS[action.kind], action.request).catch(console.error);
			}
		}
	};
}

export function GuildDomainContent({ domain }: { domain: GuildDomainSnapshot }): ReactNode {
	const [building, setBuilding] = useState<GuildBuilding | null>(null);
	const [openAmount, setOpenAmount] = useState<number>();
	const {
		actions, message
	} = useDomainCommands();
	const router = useRouter();
	return <>
		<DomainStanding domain={domain} />
		{message ? <Refusal>{message}</Refusal> : null}
		<ReimburseOffer />
		{domain.domainCityId === null
			? <Note>{i18n.t("app:guild.domainLocks.none")}</Note>
			: <>
				<SectionHeader>{i18n.t("app:guildDomain.buildings")}</SectionHeader>
				<ExpandableList>{Object.values(GuildBuilding).map(value => <BuildingEntry
					key={value}
					domain={domain}
					building={value}
					actions={actions}
					expanded={building === value}
					onSelect={(selected): void => setBuilding(current => current === selected ? null : selected)}
					onTransfer={(): void => router.navigate("/guild/shelter")}
				/>)}</ExpandableList>
				<DomainDeposits domain={domain} actions={actions} openAmount={openAmount} onOpen={setOpenAmount} />
			</>}
	</>;
}

/**
 * Away from the domain, the guild's travelling merchant only sells food, as on Discord: the treasury paying for
 * it, the refund it may call for and the foods, without the buildings that cannot be reached from here.
 */
export function GuildFoodShopContent({ shop }: { shop: GuildFoodShop }): ReactNode {
	const {
		actions, message
	} = useDomainCommands();
	return <>
		<TreasuryFigures shop={shop} />
		{message ? <Refusal>{message}</Refusal> : null}
		<ReimburseOffer />
		<GuildFoodLines shop={shop} actions={actions} />
	</>;
}

/** The guild's data the domain and the food supply both read, so a purchase in one refreshes the other; a player without a guild is told so. */
function GuildDomainQuery({ children }: { children: (domain: GuildDomainSnapshot) => ReactNode }): ReactNode {
	const state = useGameQuery(GAME_ENTITIES.GUILD_DOMAIN, () => GameClient.request(makeFromClientPacket(GuildDomainInfoReq, {}), GuildDomainInfoRes));
	return <GameQueryContent state={state} entity={GAME_ENTITIES.GUILD_DOMAIN}>{packet => packet.data ? children(packet.data) : <Note>{i18n.t("app:guild.noGuild")}</Note>}</GameQueryContent>;
}

export function GuildDomain(): ReactNode {
	return <GuildDomainQuery>{domain => <GuildDomainContent domain={domain} />}</GuildDomainQuery>;
}

export function GuildFoodShopPage(): ReactNode {
	return <GuildDomainQuery>{shop => <GuildFoodShopContent shop={shop} />}</GuildDomainQuery>;
}
