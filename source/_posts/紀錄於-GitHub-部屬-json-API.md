---
title: 紀錄於 GitHub 部屬 json API
date: 2025-06-09 18:09:47
tags: [GitHub]
excerpt: "本文介紹如何利用 GitHub Action 與 Page 建立靜態 json API，說明自動化流程設計與任務資料管理的實務經驗。"
---

## 目的

最近著手處理很久沒動的 AimLab Minimal 專案的下載源問題。

因為宗旨是讓所有使用者都能用 Javascript 撰寫任務並與其他人分享，所以需要有個下載源，給使用者檢索任務與下載。

原本的做法是用 Google Sheet + GAS 寫個簡單可呼叫的方法，任務包放在 Google 雲端上一併處理，但這樣是我中心化管理所有任務包，況且任務內容應該也會做版控，所以統一在 GitHub 上處理或許才是最優解。

{% note purple %}
主要是最近回去玩非想天則，受 [Soku Launcher](https://github.com/0Miles/soku-launcher) 這個可以管理與下載模組的啟動器啟發，因為它 [模組源的實作](https://github.com/soku-cn/source-template) 跟我的需求很相似。
{% endnote %}

## 需求

功能很單純：

**透過提交 Issue 自動提交新增任務資料的 PR 至 Source Repo**

所以大部分的工作應該是寫 GitHub Action。我希望新增任務包的流程如下：

1. 任務完成打包
2. 至 Source Repo 提交 Issue
3. Source Repo Host 透過 Issue 確認任務內容（惡意代碼或非法內容）
4. Source Repo Host 鎖定該 Issue
5. 觸發 GitHub Action，將任務內容新增至 Source Repo，並提交 PR
6. Source Repo Host 透過 PR 二次檢查任務內容，並合併至主分支
7. 觸發 GitHub Page 部屬，產生對應的 API 與內容

## Issue Template

GitHub 可以用 yml 定義 Issue Template，把需要的資訊欄位開出來，暫定是這些欄位：

- 名稱
- Git 地址
- Archieve 地址

另外需要摘要出任務的內容供前端渲染，任務製作指南有明確指示 `mission.json` 需要放在任務的根目錄，所以一併在 GitHub Action 內提取出來就行了。

```YML  .github/ISSUE_TEMPLATE/add-mission-source.yml
name: Add Mission Source
description: Add a new mission source to the repository.
title: "[Mission Name]"
labels: ["source request"]
body:
- type: input
  attributes:
    label: Mission Name
    description: |
      The name of the mission for identification purposes.
      Scope will automatically added with who create this issue to prevent conflicts.
- type: input
  attributes:
    label: Version
    description: |
      The version of the mission source.
      This is used to track changes and updates to the mission.
      It should follow semantic versioning (e.g., 1.0.0).
  validations:
    required: true
- type: input
  attributes:
    label: git URL
    description: The git URL of the mission source repository.
  validations:
    required: true
- type: input
  attributes:
    label: Mission Archive URL
    description: |
      The URL to the mission archive file (e.g., .zip, .tar.gz) that contains compiled mission data.
      GitHub release URLs is recommended.
      If not provided, the workflow will attempt to fetch the latest release from the repository.
- type: checkboxes
  attributes:
    label: Agreement
    description: |
      By submitting this issue, you agree to the following:
      - The mission source does not violate any copyrights or licenses.
      - The mission should not contain any offensive or inappropriate content.
      - The mission source should not contain any malware or harmful code.
    options:
      - label: "Agree to the terms"
        required: true
```

## 程式碼實作

GitHub Action 的 `workflow` 撰寫不會特別說明，基本需要設定觸發時機為 `Issue Locked`，以及 `Node` 執行環境。

### 分析 Issue

將 Issue 的 Markdown 格式轉成 json，我這邊是透過行數定義，之後輸出 `metadata` 提供後續生成 PR 所需的資訊：

{% note purple %}
這裡會透過 `arg` 將 Issue 內容傳入腳本內，如下：

```YML .github\workflows\mission-source-verified.yml
- name: Update mission source
  run: node utils/issueToJson.js ${{ github.event.issue.user.login }} '${{ github.event.issue.body }}'
```

{% endnote %}

```JS utils/issueToJson.js
import fs from "fs/promises";

const user = process.argv[2];
const issueMdArr = process.argv[3].split("\n");

(async function convertIssueToJson() {
  // define datas by markdown lines
  let missionName = issueMdArr[2];
  let missionVersion = issueMdArr[6];
  let missionGitUrl = issueMdArr[10];
  let missionArchiveUrl = issueMdArr[14];

  // check mission info by github api
  let missionInfoUrl = new URL(missionGitUrl);
  missionInfoUrl.hostname = "api.github.com";
  let pathName = `repos${missionInfoUrl.pathname}/contents`;
  if (missionInfoUrl.searchParams.get("path")) {
    pathName += `/${missionInfoUrl.searchParams.get("path")}`;
  }
  pathName += "/mission.json";
  missionInfoUrl.pathname = pathName;

  // response is json blob
  let info = await fetch(missionInfoUrl)
    .then((res) => res.json())
    .then((data) => JSON.parse(atob(data.content)))
    .catch((err) => {
      throw err;
    });

  missionName.replace(/ /g, "-");

  // write info
  await fs
    .mkdir(`./contents/${user}/${missionName}`, { recursive: true })
    .then(() => {
      let missionJson = {
        name: missionName,
        author: user,
        version: missionVersion,
        git_url: missionGitUrl,
        archive_url: missionArchiveUrl,
        info: info,
      };

      return fs.writeFile(
        `./contents/${user}/${missionName}/mission.json`,
        JSON.stringify(missionJson, null, 2)
      );
    })
    .catch((err) => {
      console.error("Error:", err);
    });

  // create metadata file for PR create
  fs.writeFile(
    "result-path",
    `./contents/${user}/${missionName}/mission.json`,
    (err) => {
      if (err) throw err;
      console.log("Metadata file created successfully.");
    }
  );
})();
```

### 將 metadata 寫入環境變數

將上一步生成的 metadata 寫入環境變數 `$GITHUB_ENV` 供後續 `step` 使用，這裡卡滿久的，後來查了下，如果內容是多行或有特殊符號，要特別寫 EOF：

```YML .github\workflows\mission-source-verified.yml
- name: Get Result Path
  run: |
    echo "RESULT<<EOF" >> $GITHUB_ENV
    echo "$(cat $(<result-path))" >> $GITHUB_ENV
    echo "EOF" >> $GITHUB_ENV
```

之後 `step` 中透過 `{{ env.RESULT }}` 就能取得 metadata 的內容

### 更新 Snapshot

建立快照，提供預覽任務列表：

{% note purple %}

同樣需要傳入 repo owner 當作 `arg` 避免重複的任務源，`step` 如下：

```YML .github\workflows\mission-source-verified.yml
- name: Update Snapshot
  run: node utils/updateSnapshot.js ${{ github.repository }}
```

{% endnote %}

```JS utils\updateSnapshot.js
import fs from "fs/promises";

let repositoryInfo = process.argv[2].split("/");

let missions = {};
await fs.readFile("sourceName").then((sourceName) => {
  missions["name"] = `${sourceName.toString()}@${repositoryInfo[0]}`;
});

missions["missions"] = [];

await fs
  .readdir("./contents")
  .then((files) => {
    let p = files
      .filter((file) => !file.includes(".json"))
      .map((file) =>
        fs.readdir(`./contents/${file}`).then((subFiles) => {
          subFiles.forEach((subFile) => {
            missions["missions"].push({
              name: subFile,
              author: file,
              detail_url: `https://${repositoryInfo[0].toLowerCase()}.github.io/${repositoryInfo[1]}/contents/${file}/${subFile}/mission.json`,
            });

            console.log(
              `Added mission: ${subFile} by ${file} to missions.json`
            );
          });
        })
      );
    return Promise.all(p);
  })
  .catch((err) => {
    console.error("Error reading contents directory:", err);
  });

fs.writeFile("./contents/missions.json", JSON.stringify(missions, null, 2))
  .then(() => console.log(missions))
  .catch((err) => {
    console.error("Error reading contents directory:", err);
  });
```

### 建立 PR

這邊直接用 [別人寫好的](https://github.com/peter-evans/create-pull-request) 就行了：

```YML .github\workflows\mission-source-verified.yml
- name: Create PR
  uses: peter-evans/create-pull-request@v7
  with:
    branch: "update-mission/${{ fromJson(env.RESULT).name }}"
    commit-message: "${{ fromJson(env.RESULT).name }} (${{ fromJson(env.RESULT).version }}) by @${{ github.event.issue.user.login }}"
    title: "Update mission source ${{ fromJson(env.RESULT).name }} (${{ fromJson(env.RESULT).version }}) by @${{ github.event.issue.user.login }}"
    body: |
      Update mission source ${{ fromJson(env.RESULT).name }} (${{ fromJson(env.RESULT).version }}) by @${{ github.event.issue.user.login }}.
      This PR is auto-generated by the workflow.
    draft: false
    delete-branch: true
    add-paths: |
      contents/*
```

## 小結

這次寫得比較倉促，沒經過太多整理。

拿 GitHub Page 來實現這種靜態 API 再適合不過了，加上自動化建立內容，可以玩出非常多花樣。

{% note gray %}

題外話，我不是 JS 專攻，這次非同步實作不用 callback 寫法，而是改用 promise 了。

{% endnote %}
