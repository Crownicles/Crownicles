export abstract class HelpConstants {
	static readonly HELP_INVITE_LINK = "https://discord.gg/USnCxg4";

	static readonly HELP_DM_COOLDOWN_TIME_MINUTES = 5;

	static readonly COMMAND_SEPARATOR_FOR_GENERAL_DESCRIPTION = " • ";

	static readonly POPULAR_COMMANDS = [
		"help",
		"profile",
		"report",
		"fight",
		"inventory",
		"shop",
		"guild",
		"pet",
		"daily"
	];

	static readonly COMMAND_CATEGORY = {
		UTIL: "util",
		PLAYER: "player",
		MISSION: "mission",
		GUILD: "guild",
		PET: "pet"
	};

	static readonly ACCEPTED_SEARCH_WORDS = {
		PING: [
			"ping",
			"mention",
			"uptime",
			"shard"
		],
		RESPAWN: [
			"respawn",
			"rp",
			"ressusciter",
			"revivre",
			"rv",
			"reset",
			"revivre"
		],
		PROFILE: [
			"profile",
			"profil",
			"p",
			"me",
			"info"
		],
		SWITCH: [
			"switch",
			"sw",
			"échanger",
			"echanger",
			"échange",
			"echange",
			"intervertir"
		],
		FIGHT: [
			"fight",
			"f",
			"combat",
			"duel"
		],
		LANGUAGE: [
			"language",
			"langage",
			"langue",
			"l",
			"speak"
		],
		TOP: [
			"top",
			"classement",
			"t",
			"points",
			"top score",
			"classement score",
			"topscore",
			"classementscore",
			"topscores",
			"classementscores"
		],
		GLORY_TOP: [
			"topgloire",
			"classementgloire",
			"tgloire",
			"gloire",
			"glorytop",
			"glory",
			"topglory"
		],
		GUILD_TOP: [
			"topguild",
			"classementguild",
			"classementguilde",
			"topguilde",
			"tguild",
			"tguilde",
			"guildrank",
			"guildranking",
			"guildrankings",
			"guildranks",
			"topguilds",
			"topguildes",
			"classementguilds",
			"classementguildes"
		],
		HELP: [
			"help",
			"h",
			"aide",
			"a"
		],
		INVENTORY: [
			"inventory",
			"inv",
			"i",
			"inventaire"
		],
		REPORT: [
			"report",
			"r",
			"rapport",
			"raport",
			"repport",
			"adventure",
			"play",
			"aventure",
			"advance",
			"avancer",
			"rapor",
			"repor",
			"rep",
			"game",
			"jouer"
		],
		SELL: ["sell", "vendre"],
		DAILY_BONUS: [
			"daily",
			"da",
			"récompensejournalière",
			"rj",
			"journaliere",
			"journalière",
			"recompensejournaliere",
			"recompense",
			"journalier",
			"journalièr",
			"bonus",
			"db",
			"bonusjournalier",
			"dailybonus",
			"bonusdaily"
		],
		INVITE_CROWNICLES: [
			"invite",
			"addbot",
			"inviter",
			"ajouter",
			"ajouterbot",
			"invitedraftbot",
			"adddraftbot",
			"invitdraftbot",
			"invitecrownicles",
			"addcrownicles",
			"invitcrownicles"
		],
		BADGES: ["badges", "badge"],
		DRINK: [
			"drink",
			"dr",
			"glouglou",
			"boire",
			"boir",
			"br"
		],
		SHOP: [
			"shop",
			"s",
			"magasin",
			"buy"
		],
		GUILD_CREATE: [
			"guildcreate",
			"gcreate",
			"gc",
			"créerguilde",
			"createguilde",
			"creerguilde",
			"guildecreer",
			"cg",
			"newguilde"
		],
		GUILD_LEAVE: [
			"guildleave",
			"gleave",
			"gl",
			"quitter",
			"quitterguilde",
			"guildequitter",
			"leaveguilde",
			"leaveguild",
			"quitterguild",
			"guildquitter",
			"quitguilde",
			"quitguild",
			"guildequit",
			"guildquit"
		],
		GUILD: [
			"guild",
			"guilde",
			"infoguilde",
			"infosguilde",
			"myguilde",
			"maguilde",
			"g"
		],
		GUILD_DAILY_BONUS: [
			"guilddaily",
			"gdaily",
			"gd",
			"récompensedeguilde",
			"récompenseguilde",
			"récompensedeguild",
			"récompenseguild",
			"recompensedeguilde",
			"recompenseguilde",
			"recompensedeguild",
			"recompenseguild",
			"dailyguild",
			"dailyguilde",
			"guilddailybonus",
			"gdb",
			"guildailybonus",
			"gdbonus",
			"guilddailybon",
			"gdbon"
		],
		GUILD_KICK: [
			"guildkick",
			"gkick",
			"gk",
			"expulser",
			"expulsion",
			"kick",
			"kickguild",
			"kickguilde",
			"expulserguilde",
			"expulsermembre",
			"virer",
			"eg"
		],
		GUILD_INVITE: [
			"guildadd",
			"gadd",
			"ga",
			"ajouter",
			"ajout",
			"add",
			"addguild",
			"addguilde",
			"ajouterguilde",
			"ajoutermembre",
			"invitemember",
			"ag",
			"guildinvite",
			"guildi",
			"invitationguilde",
			"invitationguild"
		],
		GUILD_DESCRIPTION: [
			"guilddescription",
			"gdesc",
			"guilddesc",
			"guildedescription",
			"descriptionguild",
			"guildescription",
			"guildesc"
		],
		GUILD_ELDER: [
			"guildelder",
			"gelder",
			"aine",
			"promotion",
			"aîne",
			"promouvoir",
			"guildeelder",
			"elderguilde",
			"elderguild"
		],
		GUILD_ELDER_REMOVE: [
			"guildelderremove",
			"gelderremove",
			"ger",
			"dégrader",
			"degrader",
			"dégrade",
			"degrade",
			"enleveraine",
			"enleveraîne",
			"enleverainedeguilde",
			"enleveraînedeguilde",
			"enleveraineguilde",
			"enleveraîneguilde",
			"enleveraineguild",
			"enleveraîneguild",
			"enleverainedeguild",
			"enleveraînedeguild",
			"removeelder",
			"guildeerlderremove",
			"geldeerremove"
		],
		GUILD_STORAGE: [
			"guildstorage",
			"gstorage",
			"gst",
			"stockage",
			"gstockage",
			"greserve",
			"stockagedeguilde",
			"guildestockage",
			"guildestorage",
			"guildstockage",
			"guildereserve",
			"entrepotguild",
			"entrepotguilde",
			"entrepotdeguild",
			"entrepotdeguild",
			"entrepot"
		],
		GUILD_SHOP: [
			"guildshop",
			"guildeshop",
			"gs",
			"magasindeguilde",
			"magasindeguild",
			"guildemagasin",
			"guildmagasin"
		],
		UPDATE: [
			"update",
			"changelog",
			"miseajour",
			"miseàjour",
			"nouveautés",
			"nouveautes"
		],
		CLASSES: [
			"class",
			"c",
			"classes",
			"classe"
		],
		PET: [
			"pet",
			"mypet",
			"p",
			"familier",
			"monfamilier",
			"monpet",
			"animal"
		],
		PET_TRANSFER: [
			"pettransfer",
			"pettr",
			"ptr",
			"ptransfer",
			"pettransfert",
			"familiertransfert",
			"ft",
			"ftransfert",
			"ftransfer"
		],
		PET_NICKNAME: [
			"petnickname",
			"petnick",
			"pnickname",
			"pnick",
			"petname",
			"pname"
		],
		PET_FREE: [
			"petfree",
			"petf",
			"pfree",
			"freepet",
			"freep",
			"libererpet",
			"libererfamilier",
			"libereranimal",
			"delivrerpet",
			"delivrerfamilier",
			"delivreranimal",
			"libérerpet",
			"libérerfamilier",
			"libéreranimal",
			"délivrerpet",
			"délivrerfamilier",
			"délivreranimal"
		],
		GUILD_SHELTER: [
			"guildshelter",
			"shelter",
			"pets",
			"animals",
			"gshelter",
			"gpets",
			"ganimals",
			"guildpets",
			"guildanimals",
			"guildanimale",
			"guildanimal",
			"sh",
			"abris",
			"aubergeanimal",
			"familiers",
			"guildeshelter",
			"abrideguilde",
			"abriguilde",
			"abrideguild",
			"abriguild",
			"abrisdeguilde",
			"abrisguilde",
			"abrisdeguild",
			"abrisguild"
		],
		PET_FEED: [
			"petfeed",
			"feed",
			"pf",
			"pfeed",
			"feedp",
			"feedpet",
			"fp"
		],
		PET_SELL: [
			"petsell",
			"psell",
			"vendrepet",
			"ventepet",
			"vendreanimal",
			"venteaniaml",
			"vendreanimale",
			"venteanimale",
			"vendreanimales",
			"venteanimales",
			"venteanimaux",
			"vendreanimaux"
		],
		CLASSES_INFO: [
			"classinfo",
			"classInfo",
			"cs",
			"classesstats",
			"classcompare",
			"classestats",
			"classtats",
			"classstat",
			"statistiquesclass",
			"statistiquesclasse",
			"statistiquesclasses",
			"statistiqueclass",
			"statistiqueclasse",
			"statistiqueclasses",
			"classstatistiques",
			"classestatistiques",
			"classesstatistiques",
			"classstatistique",
			"classestatistique",
			"classesstatistique",
			"classinfos",
			"classinfosstats",
			"classesinfo",
			"classesinfo"
		],
		RARITY: [
			"rarity",
			"rarities",
			"rareté",
			"rarete",
			"rare"
		],
		VOTE: [
			"vote",
			"ilovedraftbot",
			"votes",
			"voté",
			"voter",
			"votés"
		],
		IDEA: [
			"idea",
			"ideas",
			"suggestions",
			"suggestion",
			"suggest",
			"idée",
			"idé",
			"idées",
			"idés",
			"idee",
			"ide",
			"idees",
			"ides"
		],
		NOTIFICATIONS: [
			"dmnotifications",
			"dmn",
			"notificationsmp",
			"notificationsprivées",
			"notificationsmps",
			"notificationmp",
			"notifs",
			"dms",
			"notif",
			"dmnotification",
			"mp",
			"mpdésac",
			"mpdesac",
			"mpdésacactivé",
			"mpdesactive",
			"mpdésacactiver",
			"mpdésacactive",
			"notifications",
			"n",
			"notification",
			"désac",
			"desac",
			"désactivé",
			"desactive",
			"désactiver",
			"désactive"
		],
		UNLOCK: [
			"unlock",
			"bail",
			"release",
			"libérer",
			"liberer",
			"libére",
			"libere",
			"libéreration",
			"libereration",
			"jail",
			"prison",
			"délivrer",
			"delivre",
			"délivre"
		],
		MAP: [
			"map",
			"world",
			"monde",
			"carte"
		],
		MISSIONS: [
			"missions",
			"m",
			"mission",
			"quests",
			"quest",
			"q",
			"quête",
			"quete",
			"quêtes",
			"quetes"
		],
		MISSIONS_SHOP: [
			"missionshop",
			"ms",
			"mshop",
			"questshop",
			"missionsshop",
			"questsshop",
			"qs",
			"shopmissions",
			"shopmission",
			"magasindemissions",
			"magasindemission",
			"missionmagasin",
			"missionsmagasin",
			"magasinmissions",
			"magasinmission"
		],
		LEAGUE_BONUS: [
			"leaguereward",
			"leaguerewards",
			"league",
			"leagues",
			"leagueaward",
			"bonusleague",
			"leaguebonus",
			"leagueaward",
			"leagueawards",
			"bonusligue",
			"liguebonus",
			"récompenseligue",
			"liguerécompense",
			"leaguerécompense",
			"récompenseleague",
			"recompenseleague",
			"recompenseligue",
			"liguerécompenses",
			"leaguerécompenses",
			"récompensesligue",
			"récompensesleague",
			"recompensesleague"
		],
		JOIN_BOAT: [
			"joinboat",
			"boat",
			"bateau",
			"rejoindrebateau"
		]
	};

	static readonly COMMANDS_DATA = {
		PING:
			{
				EMOTE: ":ping_pong:",
				NAME: "ping",
				CATEGORY: "util"
			},
		RESPAWN:
			{
				EMOTE: ":angel:",
				NAME: "respawn",
				CATEGORY: "player"
			},
		PROFILE:
			{
				EMOTE: ":bust_in_silhouette:",
				NAME: "profile",
				CATEGORY: "player"
			},
		SWITCH:
			{
				EMOTE: ":repeat:",
				NAME: "switch",
				CATEGORY: "player"
			},
		FIGHT:
			{
				EMOTE: ":crossed_swords:",
				NAME: "fight",
				CATEGORY: "player"
			},
		HELP:
			{
				EMOTE: ":notebook_with_decorative_cover:",
				NAME: "help",
				CATEGORY: "util"
			},
		LANGUAGE:
			{
				EMOTE: ":flag_gb:",
				NAME: "language",
				CATEGORY: "util"
			},
		TOP:
			{
				EMOTE: ":trophy:",
				NAME: "top score",
				CATEGORY: "player"
			},
		GLORY_TOP:
			{
				EMOTE: ":sparkles:",
				NAME: "top glory",
				CATEGORY: "player"
			},
		GUILD_TOP:
			{
				EMOTE: ":mirror_ball:",
				NAME: "top guild",
				CATEGORY: "guild"
			},
		INVENTORY:
			{
				EMOTE: ":school_satchel:",
				NAME: "inventory",
				CATEGORY: "player"
			},
		REPORT:
			{
				EMOTE: ":newspaper:",
				NAME: "report",
				CATEGORY: "player"
			},
		SELL:
			{
				EMOTE: ":moneybag:",
				NAME: "sell",
				CATEGORY: "player"
			},
		DAILY_BONUS:
			{
				EMOTE: ":calendar:",
				NAME: "dailybonus",
				CATEGORY: "player"
			},
		INVITE_CROWNICLES:
			{
				EMOTE: ":inbox_tray:",
				NAME: "invitecrownicles",
				CATEGORY: "util"
			},
		BADGES:
			{
				EMOTE: ":military_medal:",
				NAME: "badges",
				CATEGORY: "util"
			},
		DRINK:
			{
				EMOTE: ":tropical_drink:",
				NAME: "drink",
				CATEGORY: "player"
			},
		SHOP:
			{
				EMOTE: ":shopping_cart:",
				NAME: "shop",
				CATEGORY: "player"
			},
		GUILD_CREATE:
			{
				EMOTE: ":pencil:",
				NAME: "guildcreate",
				CATEGORY: "guild"
			},
		GUILD_LEAVE:
			{
				EMOTE: ":outbox_tray:",
				NAME: "guildleave",
				CATEGORY: "guild"
			},
		GUILD:
			{
				EMOTE: ":stadium:",
				NAME: "guild",
				CATEGORY: "guild"
			},
		GUILD_DAILY_BONUS:
			{
				EMOTE: ":newspaper:",
				NAME: "guilddailybonus",
				CATEGORY: "guild"
			},
		GUILD_KICK:
			{
				EMOTE: ":leg:",
				NAME: "guildkick",
				CATEGORY: "guild"
			},
		GUILD_INVITE:
			{
				EMOTE: ":incoming_envelope:",
				NAME: "guildinvite",
				CATEGORY: "guild"
			},
		GUILD_DESCRIPTION:
			{
				EMOTE: ":writing_hand:",
				NAME: "guilddescription",
				CATEGORY: "guild"
			},
		GUILD_ELDER:
			{
				EMOTE: ":military_medal:",
				NAME: "guildelder",
				CATEGORY: "guild"
			},
		GUILD_ELDER_REMOVE:
			{
				EMOTE: ":outbox_tray:",
				NAME: "guildelderremove",
				CATEGORY: "guild"
			},
		GUILD_STORAGE:
			{
				EMOTE: ":pencil:",
				NAME: "guildstorage",
				CATEGORY: "guild"
			},
		GUILD_SHOP:
			{
				EMOTE: ":shopping_cart:",
				NAME: "guildshop",
				CATEGORY: "guild"
			},
		UPDATE:
			{
				EMOTE: ":scroll:",
				NAME: "update",
				CATEGORY: "util"
			},
		CLASSES:
			{
				EMOTE: ":bookmark:",
				NAME: "classes",
				CATEGORY: "player"
			},
		PET:
			{
				EMOTE: ":dog:",
				NAME: "pet",
				CATEGORY: "pet"
			},
		PET_TRANSFER:
			{
				EMOTE: ":arrow_right:",
				NAME: "pettransfer",
				CATEGORY: "pet"
			},
		PET_NICKNAME:
			{
				EMOTE: ":abcd:",
				NAME: "petnickname",
				CATEGORY: "pet"
			},
		PET_FREE:
			{
				EMOTE: ":wave:",
				NAME: "petfree",
				CATEGORY: "pet"
			},
		GUILD_SHELTER:
			{
				EMOTE: ":park:",
				NAME: "guildshelter",
				CATEGORY: "guild"
			},
		PET_FEED:
			{
				EMOTE: ":candy:",
				NAME: "petfeed",
				CATEGORY: "pet"
			},
		PET_SELL:
			{
				EMOTE: ":dollar:",
				NAME: "petsell",
				CATEGORY: "pet"
			},
		CLASSES_INFO:
			{
				EMOTE: ":bookmark:",
				NAME: "classesinfo",
				CATEGORY: "player"
			},
		RARITY:
			{
				EMOTE: ":slot_machine:",
				NAME: "rarity",
				CATEGORY: "util"
			},
		VOTE:
			{
				EMOTE: ":ballot_box:",
				NAME: "vote",
				CATEGORY: "util"
			},
		IDEA:
			{
				EMOTE: ":bulb:",
				NAME: "idea",
				CATEGORY: "util"
			},
		NOTIFICATIONS:
			{
				EMOTE: ":no_bell:",
				NAME: "notifications",
				CATEGORY: "util"
			},
		UNLOCK:
			{
				EMOTE: ":slot_machine:",
				NAME: "unlock",
				CATEGORY: "player"
			},
		MAP:
			{
				EMOTE: ":map:",
				NAME: "map",
				CATEGORY: "player"
			},
		MISSIONS:
			{
				EMOTE: ":scroll:",
				NAME: "missions",
				CATEGORY: "mission"
			},
		MISSIONS_SHOP:
			{
				EMOTE: ":shopping_cart:",
				NAME: "missionsshop",
				CATEGORY: "mission"
			},
		LEAGUE_BONUS:
			{
				EMOTE: ":sparkles:",
				NAME: "leaguebonus",
				CATEGORY: "player"
			},
		JOIN_BOAT:
			{
				EMOTE: ":ferry:",
				NAME: "joinboat",
				CATEGORY: "guild"
			}
	};
}
