---
title: SpacetimeDB 試用
date: 2025-04-12 17:55:16
tags: [Unity, C#, Rust]
---

## 都是個啥

### 背景

照官方的說法，SpacetimeDB 是為了給他們開發的 MMORPG 遊戲實現連線機能，遊戲內的連線基本上分成三種：

1. 實時傳輸
2. 資料存儲
3. 後端邏輯

而現行存在的解決方案過於混雜且功能不全面，例如：

- Firebase 提供了很多解決方案，包含存儲及資料傳輸，雖然算是易用但過於零碎，且無後端實現
- Photon 提供了多人遊戲的數據傳輸、配對、存儲等解決方案，但綁定得過死，所以選用就得要全家桶
- Unity Netcode、Mirror 等連線方案，可以在 Unity 內用 C# 完成機能，也最大化了功能的自訂性，但沒有資料庫與後端
- AWS、GCP、AZURE 等，屬於完全的解決方案，但實現過程極其複雜，所需要的技術堆疊也非常廣，對於小團隊開發者來說是相當吃力不討好的

所以 SpacetimeDB 就是為了加速開發連線機能而催生出來的解決方案，全面且易用。

{% note purple %}
完全解決方案或許才是最優解，因為 Spacetime DB 本身極有可能成為一個黑盒子，但如果能更專注在遊戲內容開發，對小型團隊來說幫助非常大。
{% endnote %}

### 技術實現

跟以往的資料庫、後端分層架構不同，SpacetimeDB 正如他的名字就是個資料庫，所有操作都是基於資料庫。之前說的三種連線分別對應到：

- `Table` > 存儲
- `Reducer` > 後端邏輯
- `Subscription Query` > 實時傳輸

SpacetimeDB 本身是使用 Rust 語言寫的，伺服端支援 Rust 或 C# 編寫（官方表示用 Rust 寫效能好些），客戶端支援生成 Rust、C#、TypeScript 介面綁定。

伺服端使用 ORM 設計資料關聯，編譯成 WebAssembly 執行。

{% note purple %}
目前遷移流程極其複雜，是一大痛點。。。
{% endnote %}

## 實作

我要做個簡單的 3D 多人互動範例，測試機能：

- 伺服端：

  - 實作 `Table`、`Reducer`
  - `Schedule` 排程運行邏輯

- 客戶端：

  - 生成介面綁定
  - 呼叫 `Reducer`
  - 綁定 `Update` 回呼

### 專案環境

我的操作系統是 Windows 10，已經安裝 `WSL2`（`Ubuntu`） 及 `Docker`，Unity 版本為 `6000.0.31f1`。

接下來會用 Rust 撰寫伺服端，生成 C# 介面綁定在客戶端使用。

先新建一個 Unity 專案，這邊使用 `URP 3D` 模板，並新增路徑 `/SpacetimeDBProj` 作為伺服端專案根目錄，具體專案根目錄結構如下：

```shell
$ git ls-tree -r --name-only HEAD | tree --fromfile -L 1
.
├── .gitignore
├── Assets
├── Packages
├── ProjectSettings
└── SpacetimeDBProj
```

{% note purple %}
配置 `gitignore` 使用 git 做版控這裡就不多贅述了。
{% endnote %}

### 安裝 SpacetimeDB

需要先安裝 `SpacetimeDB CLI`，雖然能直接裝在 Windows 上，為了後續部屬方便，我選擇在 Docker Container 內運行。

先從 `Dockerfile` 開始設定：

```Dockerfile Dockerfile
FROM clockworklabs/spacetime:latest

USER root

RUN mkdir -p /root/.local/share/spacetime/bin

RUN ln -s /home/spacetime/.local/share/spacetime/bin/current /root/.local/share/spacetime/bin/current

ENV PATH=/home/spacetime/.local/bin:/usr/share/dotnet:/root/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

ENTRYPOINT [ "bash" ]
```

{% note purple %}
這邊特別改用 `USER root` 並設定環境變數的原因是為了開發時不需要再安裝 `rust`、`cargo`、`dotnet`，如果使用原本的 `Image`（綁定 `USER spacetime`，基本只是為了跑 `spacetime start`）會因為權限問題導致無法使用匯出等指令。
{% endnote %}

設定 `docker-compose` 以防之後服務需要擴充：

```YML docker-compose.yml
version: '3.8'
services:
  spacetimedb:
    container_name: spacetimedb
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ..:/Project
    working_dir: /Project/SpacetimeDBProj
    tty: true
    stdin_open: true
```

{% note purple %}
設定整個專案為 `volumes`，後續生成介面綁定。
{% endnote %}

會寫個簡單的 `Makefile` 來簡化啟動指令：

```makefile Makefile
DOCKER_CMD := docker-compose -f docker-compose.yml
CONTAINER_CMD := docker exec -it spacetimedb

build:
	$(DOCKER_CMD) build

up:
	$(DOCKER_CMD) up -d

down:
	$(DOCKER_CMD) down

app:
	$(CONTAINER_CMD) bash
```

運行指令 `make build`、`make up` 就可以讓 `Docker` 建置環境跟運行了。

{% note purple %}
指令都是在 `WSL` 底下執行。
{% endnote %}

### 初始化伺服端

```shell
$ make app
docker exec -it spacetimedb bash

$ spacetime init --lang=rust server
Project successfully created at path: server

$ tree
.
├── Dockerfile
├── Makefile
├── docker-compose.yml
└── server
    ├── Cargo.toml
    └── src
        └── lib.rs
```

{% note purple %}
我是在 Windows 底下安裝 `cargo` 用 `vscode` 編輯專案（專案不是用 `SSH` 連入 `WSL`），需要為 `rust-analyzer` 配置專案路徑：

```json .vscode/settings.json
{
    .
    .
    .
    "rust-analyzer.linkedProjects": [
        "./SpacetimeDBProj/server/Cargo.toml",
    ]
}
```

{% endnote %}

### 資料結構定義

遊戲物件位置是基於 `Vector3` 操作，直接使用 [vector3](https://github.com/local-interloper/vector3/blob/main/src/vector3.rs) 方便後續向量操作。

除了將缺失的類別刪掉外，最重要的是加上 `SpacetimeType` 派生，才能將類別使用在資料庫內。

```rust server/types/vector3.rs
#[derive(SpacetimeType, Clone, Copy, Default)]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}
```

{% note gray %}
關於 `rust` 管理 `mod` 的相關知識就不多贅述了。

另外，如果你有時間，也可以自己寫定義，但那就是遊戲引擎相關的話題了。。。
{% endnote %}

之後是遊戲內物件定義：

{% tabs models %}

<!-- tab 玩家資料 -->
```rust player.rs
#[spacetimedb::table(name = player, public)]
pub struct Player {
    #[primary_key]
    identity: Identity,
    #[unique]
    #[auto_inc]
    id: u32,
    name: String,
}
```
<!-- endtab -->

<!-- tab 世界 -->
```rust world.rs
#[spacetimedb::table(name = world)]
pub struct World {
    #[primary_key]
    #[unique]
    #[auto_inc]
    id: u32,
    size: u32,
    center: Vector3,
}
```
<!-- endtab -->

<!-- tab 物件 -->
```rust entity.rs
#[spacetimedb::table(name = entity, public)]
pub struct Entity {
    #[primary_key]
    #[unique]
    #[auto_inc]
    id: u32,
    name: String,
}
```
<!-- endtab -->

<!-- tab 玩家物件 -->
```rust dummy.rs
#[spacetimedb::table(name = dummy, public)]
pub struct Dummy {
    #[primary_key]
    entity_id: u32,
    #[index(btree)]
    player_id:u32,
    pos: Vector3,
    vel: Vector3,
}
```
<!-- endtab -->

{% endtabs %}

### Unity 端實作

待續