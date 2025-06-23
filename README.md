<div style="text-align: center;">
<img src="https://crownicles.com/public/ressources/Crownicles_logo_HD.png" style="border-radius: 50%; width: 300px" alt="Couronne Crownicles">

Crownicles is a text adventure game. The story takes place in a medieval world, and the player embodies an adventurer who
wants to win a competition launched by the king, to win the princess' hand. To achieve this, he must travel and earn
points by going through a lot of danger, including thieves, wilderness, and scary children. Every few hours, the player
can follow their adventure through "reports" and interact with a multiple choice system, using reactions below the
report. Each choice has multiple issues, which could hurt the character, heal them, or even give them some stuff. During
the journey, they earn money, equipments, and points, and can use them to buy potions, items, or effects in the shop,
fight other players, and ascend the leaderboard.

[![](https://img.shields.io/discord/429765017332613120.svg)](https://discord.gg/5JqrMtZ)
[![](https://img.shields.io/github/stars/Crownicles/Crownicles.svg?label=Stars&style=social)](https://github.com/Crownicles/Crownicles)

</div>

<br>

# How to play the game?

Crownicles is originally a discord bot and has evolved to become a fully fledged game that you can play either through
discord or through other clients.

You can start playing by visiting our website: https://crownicles.com

# Create a custom Crownicles instance

_Before creating your own instance, please note that you can add the bot to your server through the link available on
the bot's discord_

**If you decide to work on the creation of your own instance of the bot, you are supposed to have a minimum of computer
skills. Bot support team will prioritize players of the main instance and will only provide very limited assistance. We
will fix bugs you report, but we will not teach you how to code a discord bot.**

Please do not copy and paste the commands we provide in this readme without :

- Understanding the command
- Replacing the relevant parts with your data
- Having read the whole document

**Only the code available in the "release" tab is considered "stable".**

## Dev environment setup

### Requirements

This list contains all the software programs necessary to run Crownicles. Our start guide will walk you through the
installation process

- Docker desktop
  - 🐧: https://docs.docker.com/engine/install/
  - 🪟: https://docs.docker.com/docker-for-windows/install/
- Webstorm
  - (or any other IDE, but we recommend Webstorm since our team uses it and we provide configurations for it)
- Git
- nvm (not mandatory but highly recommended)
  - 🪟: https://github.com/coreybutler/nvm-windows
  - 🐧: https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating
- Node
  - (see package.json of any service for the relevant version)

### Start guide

This guide will help you run Crownicles on your computer. We provide instructions for Linux, MacOS (🐧) and Windows (🪟). If
not specified, the command is the same for all OS.
Please do not skip any step of this guide; otherwise, the following commands will not work.

> For step 1 and 2, you can either do it manually or use [this script](./launchScripts/firstConfig.sh) to do it (Linux and MacOS only)

1. Install Pnpm

- Follow the provided guide to install pnpm: https://pnpm.io/installation#using-corepack
> Beware, if you do this at the root of the project, this will create a new package.json file, you can delete this file

2. Setup projects

Run `pnpm i` in each project folder:

```sh
cd Lib && pnpm i
cd ../Discord && pnpm i
cd ../Core && pnpm i
```

3. Setup database, Keycloak and an MQTT broker

#### Keycloak

For Keycloak, follow instructions in [README.md](./keycloak/README.md) in the keycloak folder.

#### Database

For the database, you can use a mariadb container with the following command:

```sh
# Run mariadb database with docker
docker run -d --name mariadb -e MARIADB_USER=crownicles -e MARIADB_PASSWORD=secret_password -e MARIADB_ROOT_PASSWORD=super_secret_password -v /path/to/volumes/mariadb:/var/lib/mysql -p 3306:3306 mariadb:latest
```

#### MQTT broker

You can use any MQTT broker, but we recommend using Mosquitto.

You can use [this guide](https://github.com/sukesh-ak/setup-mosquitto-with-docker) to install it with docker. Step 1, 2,
3, and 5 are enough to have a working MQTT broker.

The following config file can be used:

```
allow_anonymous true
listener 1883
persistence true
persistence_file mosquitto.db
persistence_location /mosquitto/data/
```

The only thing important is to allow anonymous connections.

4. Fill config files

```sh
# Copy files with default values
cp $CROWNICLES_ROOT/Core/config/config.default.toml $CROWNICLES_ROOT/Core/config/config.toml
cp $CROWNICLES_ROOT/Discord/config/config.default.toml $CROWNICLES_ROOT/Discord/config/config.toml
# The Core module also need access to the Keycloak server on the first launch
touch $CROWNICLES_ROOT/Core/config/keycloak.toml # 🐧
New-Item $CROWNICLES_ROOT/Core/config/keycloak.toml # 🪟
```

You can copy and paste the content of the keycloak section from the config.toml file in the Discord folder in the
keycloak.toml file.

5. Run projects

```sh
# First: start the core module
cd $CROWNICLES_ROOT/Core && pnpm start
# Then: start the discord module
cd $CROWNICLES_ROOT/Discord && pnpm start
```

You can set up npm launch scripts to make the start easier.
From now on you should be able to start the bot by running `pnpm start` in the Core and Discord folders while having the
database and keycloak running.
Starting order is important, starts with the database container and keycloak, then the Core and finally the Discord
module.

# Docker container

You can also compile the bot in a docker container. To do so, you can use the following commands **at the root of the project**:

```sh
docker build . -f Core/Dockerfile -t crownicles/core
docker build . -f Discord/Dockerfile -t crownicles/discord
```

# License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) or, at your option, any later version.

For details, see the [LICENSE](LICENSE) file in this repository.

# Screenshots

![image](https://user-images.githubusercontent.com/56274541/120916573-ad599000-c6aa-11eb-9e6f-ccc804bc63b2.png)

# Links

- [Website](https://crownicles.com)
- [Discord server _(in French)_](https://discord.gg/5JqrMtZ)
- [Suggestion board _(in French)_](https://feedback.crownicles.com/)
- [Player guide](https://guide.crownicles.com)
