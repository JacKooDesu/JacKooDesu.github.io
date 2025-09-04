---
title: Tauri + React 初體驗
date: 2025-08-27 14:44:28
tags: [Rust, JavaScript, React, Tauri]
---

## 前言

最近想對 {% post_link 夢回-2020-VR-開發-下 %} 裡面所說的中控軟體做不同的實現，是關於輸出學習歷程的功能。

原本對方的需求是，要把學習歷程（使用教材的情況）格式化輸出，但這部分有幾個不合理的地方：

- 不同平台，存檔位置不同（儘管都是 `Android` 基底）
- 建置後不好除錯，插插拔拔的
- 輸出的檔案，或許是 `json`？又或是 `csv`？總之不是人好閱讀的格式，不知道該用甚麼軟體檢視

{% note gray %}

應該說這是陳年已久的問題。在舊版本開發時就有學習歷程的部分，但我當時輸出的資料結構超簡單，就是個 `csv` 表格，用 Excel 開還有點辦法。更新之後就比較複雜，所以才會想完善，也算是練練手。

{% endnote %}

所以我打算直接將學習歷程導出的機能做進連線內，原本想過把改過的 `DLL` 傳給他們，但這樣改人家的檔案，好像也不是很好。

那也可以用 `Unity` 直接重新寫一個新的給他們，但看到那包插件頭就有點痛，而且不有趣。

正好我已經觀望 `Tauri` 好一段時間，也很久沒跟 `Rust` 打交道了，就用它來實現看看。

{% note purple %}

雙端通訊是透過 `UDP`，`Rust` 標準庫有提供，所以沒啥問題，只需要參考源碼重寫封包解碼的部分。

{% endnote %}

## 專案建立

照官方的教學來。

建立專案：

```powershell
irm https://create.tauri.app/ps | iex
```

就是個 [腳手架](https://github.com/tauri-apps/create-tauri-app)，工具鏈選 `TypeScript` + `React` + `npm`。

出來的專案檔，打開 `src-tauri/lib.rs` 就可以寫 `tauri::command` 給前端呼叫愉快玩耍了。

## 眉眉角角

真的要說，其實 `Rust` 沒有那麼硬，撇除掉編譯器教你做人的部分，我覺得標準庫提供的功能就很足夠了。先提幾個點：

- 因為碰到非同步，那沒啥好說的，用 `tokio`
- 走了非同步，`Arc` + `RwLock` + `Mutex` 是線程安全的好朋友
- `lazy-static` 基本上也是必備的套件

另外，我是前端小菜，`React` 趨近於邊做邊學，所以可能有些部分會沒處理好或是很醜，就先這樣吧。

## UDP 連線部分

先定義 `SocketHandler`：

```rust handler.rs
use std::sync::Arc;
use tokio::{net::UdpSocket, task::JoinHandle};

pub(crate) struct SocketHandler {
    socket: Option<Arc<UdpSocket>>,                 // socket 本體
    task: Option<JoinHandle<()>>,                   // socket 接收的非同步任務
    client_live_checker: Option<JoinHandle<()>>,    // 檢查 client timeout 的非同步任務
}
```

{% note purple %}

`tokio::net::UdpSocket` 是非同步封裝版本，要跟 `std::net::UdpSocket` 做出區隔。

`client_live_checker` 內部實作不會細講，就是每隔一段時間檢查 `client` 最後一次與我們通訊的時間。

{% endnote %}

接著就是啟動與停止的方法：

```rust handler.rs
const FM_SERVER_PORT: u16 = 3333;   // 3333，與原本的實作相同

impl SocketHandler {
    pub(crate) async fn run(&mut self) -> bool {
        if let Some(_) = self.socket {
            return false;
        }

        if let Some(_) = self.task {
            return false;
        }

        let socket_result = UdpSocket::bind(format!("0.0.0.0:{}", FM_SERVER_PORT)).await;
        if let Ok(socket) = socket_result {
            self.init(socket);
            return true;
        }

        return false;
    }

    fn init(&mut self, socket: UdpSocket) {
        let arc_socket = Arc::new(socket);
        let socket = arc_socket.clone();

        let task = tokio::task::spawn(async move {
            let mut buf = [0; 8192];    // 8192 u8 buffer
            loop {
                match arc_socket.recv_from(&mut buf).await {
                    Ok((len, addr)) => {
                        // on receive logics
                        Self::on_receive_raw(&buf, len, addr).await;
                    }
                    Err(e) => {
                        eprintln!("Error receiving data: {}", e);
                    }
                }
            }
        });

        let client_live_checker = tokio::task::spawn(/*...*/);

        self.task = Some(task);
        self.socket = Some(socket);
        self.client_live_checker = Some(live_checker);

        println!("SocketHandler initialized at {:?}", self.socket);
    }

    pub(crate) fn stop(&mut self) {
        if let Some(task) = self.task.take() {
            task.abort();
        }
        self.socket = None;

        if let Some(live_checker) = self.client_live_checker.take() {
            live_checker.abort();
        }
        self.client_live_checker = None;

        println!("SocketHandler stopped");
    }
}
```

{% folding purple::🔨 %}

- 綁定 `0.0.0.0` 而不是 `127.0.0.1` 可以解決多網卡的問題
- 使用 `Arc` 製作智能指針，`clone`（指針）才不會有所有權問題
- `8192` 緩衝是為了應對原本實作，以最大 `8096/chunk` 來進行傳輸

{% endfolding %}

這樣只要呼叫 `fm_network::run()` 就可以把 `UdpSocket` 跑起來了。

## 事件處理

因為是重新實現，所以說解封包那些沒啥意義。

另外，這個連線的實現本來就該可以獨立跑起來。
意思是說，新的實作不該依賴 `Tauri`（的消息系統），所以自然需要重新實作與外部溝通的部分。

那麼就寫個簡單的 `Listener`：

```rust listener.rs
// FMAction 是事件內容，傳到 tauri 後端供後續使用
struct Listener {
    callback: Arc<dyn Fn(&FMAction) + Send + Sync>,
}
```

我也懶得想解除訂閱的問題，反正就只是個 `callback`，等之後要擴充再說了。

{% note purple %}

方法本身只是個簽章，所以是長度未知的，只能是指針，且一樣為了服務非同步，得用 `Arc`。

{% endnote %}

把模組包好，也在這邊把 `lazy_static` 給宣告：

```rust fm_network.rs
pub mod handler;
pub mod listener;
pub mod action;
pub mod client;
// and more
// .
// .
// .

use lazy_static::lazy_static;
use tokio::sync::RwLock;
use std::sync::Arc;
use std::ops::Deref;
use std::net::SocketAddr;

lazy_static! {
    static ref SOCKET_HANDLER: RwLock<SocketHandler> = RwLock::new(SocketHandler::new());
    static ref LISTENERS: RwLock<Vec<Arc<Listener>>> = RwLock::new(Vec::new());
    // and more
    // .
    // .
    // .
}

pub async fn run() -> bool {
    let mut handler = SOCKET_HANDLER.write().await;

    handler.run().await
}

pub async fn stop() {
    let mut handler = SOCKET_HANDLER.write().await;
    handler.stop();
}

pub async fn send(addr: Addr, packet: FMPacket) {
    SOCKET_HANDLER.read().await.send(addr.into(), packet).await;
}

pub async fn listen<F>(callback: F)
where
    F: Fn(&FMAction) + Send + Sync + 'static,
{
    let mut writer = LISTENERS.write().await;
    writer.push(Arc::new(Listener {
        callback: Arc::new(callback),
    }));
}

pub(crate) async fn emit_action<'a>(action: FMAction<'a>) {
    for listener in LISTENERS.read().await.iter() {
        listener.callback.deref()(&action);
    }
}
```

{% folding purple::🔨 %}

- `tokio::sync::RwLock` 才能進行非同步的讀寫
- `send()` 的 `addr` 是重新寫過的，會自動把 `port` 改成 `3334`（符合原本實作），所以才有 `into()`
- `emit_action()` 的 `listener.callback.deref()()` 與 `(*listener.callback)()` 等效，只是我不喜歡加屁眼在前面

{% endfolding %}

## 關於 JPEG 解密

之前的文章有稍微提到，原本實作是將畫面擷取出來變成 `JPEG` 傳輸，所以本質上就是個逐格動畫。

因為一張 `JPEG` 在高畫質的情況下可能會很大，為了避免炸記憶體跟頻寬，把資料切小塊傳比較合理。

所以 `JPEG` 的封包就被拆成 `Header` 跟 `Data` 兩部分。最後的解碼器結構就像這樣：

```rust jpeg_decoder.rs
pub struct JPEGDecoder {
    header: JPEGHeader,
    data: Vec<u8>,
    byte_received: i32,
}

#[derive(Clone, Copy, Debug)]
pub struct JPEGHeader {
    // label: i32,         // 0 - 3
    id: i32,     // 4 - 7
    length: i32, // 8 - 11
    offset: i32, // 12 - 15
    gzip: bool,  // 16
    // color_reduction: u8, // 17
}

impl JPEGDecoder {
    pub fn new(header: JPEGHeader) -> Self {
        Self {
            data: vec![0; header.length as usize],
            header,
            byte_received: 0,
        }
    }

    pub fn append_data(
        &mut self,
        header: JPEGHeader,
        data: &Vec<u8>,
    ) -> Result<Option<&Vec<u8>>, String> {
        // 先檢查 header id 是否相同
        if header.id != self.header.id {
            // 不同 id，且前一包並沒有完整接收
            if self.byte_received != self.header.length {
                println!(
                    "Warning: JPEG ID mismatch. Expected {}, got {}. Resetting decoder.",
                    self.header.id, header.id
                );
            }
            // 重置解碼器資料
            self.header = header;
            self.data = vec![0; header.length as usize];
            self.byte_received = 0;
        }

        let offset = header.offset as usize;
        let data_len = data.len();

        let end_at = offset + data_len;
        if end_at > self.header.length as usize {
            return Err("Data exceeds header length".into());
        }

        self.data[offset..end_at].copy_from_slice(&data[..]);
        self.byte_received += data_len as i32;

        if self.byte_received < self.header.length {
            return Ok(None);
        }

        if self.header.gzip { /* gzip logics */ }
        Ok(Some(&self.data))
    }
}

impl JPEGHeader {
    pub fn new(data: &[u8]) -> Self {
        Self {
            // label: i32::from_le_bytes(data[0..4].try_into().unwrap()),
            id: i32::from_le_bytes(data[4..8].try_into().unwrap()),
            length: i32::from_le_bytes(data[8..12].try_into().unwrap()),
            offset: i32::from_le_bytes(data[12..16].try_into().unwrap()),
            gzip: data[16] != 0,
            // color_reduction: data[17],
        }
    }
}
```

{% folding purple::🔨 %}

- `label`、`color_reduction` 沒有用到，所以省略
- `gzip` 的部分，是直接用 `late2::read::GzDecoder` 來完成解壓縮

{% endfolding %}

解碼完輸出的 `Vec<u8>` 就可以用 `emit_action()` 供後續使用。

## 學習歷程導出機能

想法很單純，原本的 `raw bytes packet` 會用第 `2 byte` 判斷封包類型，而原插件只有 `2` 種，但一個 `byte` 可有 `8` 位元，於是從這裡下手，寫第三種封包判斷。

為了省事，直接用 `json` 格式，最後輸出到前端比較方便。轉換跟儲存的方法如下：

```rust handler.rs
use std::collections::HashMap;
use std::path::PathBuf;
use serde_json::Value;

async fn decode_play_history(json: &str) {
    if let Ok(play_history_map) = serde_json::from_str::<HashMap<String, Value>>(json) {
        if let Some(user_id) = play_history_map.get("userId") {
            let user_id = user_id.as_str().unwrap_or_else(|| "unknown");
            emit_action(FMAction::HistoryReceived(HistoryDetail::new(
                user_id,
                play_history_map.to_owned(),
            )))
            .await;
        }
    }
}

async fn save_play_history(user_id: &String, map: &HashMap<String, Value>) -> Option<String> {
    let mut file_path = PathBuf::new();
    file_path.push(PLAY_HISTORY_PATH);
    tokio::fs::create_dir_all(&file_path).await.ok();
    file_path.push(format!("{}.json", user_id));

    if let Ok(json) = serde_json::to_string(&map) {
        if let Ok(mut file) = File::create(&file_path).await {
            if let Err(e) = file.write_all(json.as_bytes()).await {
                eprintln!("Error writing play history to file: {}", e);
            } else if let Some(path) = file_path.to_str() {
                println!("Play history saved to file: {}", file_path.display());

                return Some(path.into());
            }
        } else {
            eprintln!("Error creating play history file: {}", file_path.display());
        }
    }

    None
}
```

{% folding purple::🔨 %}

- 路徑相關，相對位置是根據執行檔的目錄，使用系統路徑才是更好的解法
- `save_play_history()` 是透過 `emit_action()` 的 `Listener.callback()` 執行（同步方法），需要用 `tokio::task::spawn` 完成非同步方法呼叫
- 延續上一點，`save_play_history()` 本身是非同步方法，`map` 參數只是借用不是很好，需要注意所有權轉移

{% endfolding %}

## 指令綁定

到這裡就重新實作完了，把需要用到的指令寫到 `lib.rs` 內給前端呼叫。

```rust lib.rs
// use ...

mod fm_network;

lazy_static! {
    static ref PLAY_HISTORY_CACHE: RwLock<HashMap<String, HashMap<String, Value>>> =
        RwLock::new(HashMap::new());
}

#[tauri::command]
async fn start_udp<R: Runtime>(window: Window<R>) {
    if !fm_network::run().await {
        return;
    }

    fm_network::listen(move |data| match data {
        FMAction::ClientChanged(detail) => {
            let _ = window
                .app_handle()
                .emit_to(window.label(), "fm://client_changed", detail);
        }
        FMAction::JpegDecoded(detail) => {
            let _ = window
                .app_handle()
                .emit_to(window.label(), "fm://jpeg_decoded", detail);
        }
        FMAction::HistoryReceived(detail) => {/* on received logic */}
        _ => {}
    })
    .await;
}

#[tauri::command]
async fn stop_udp() {
    fm_network::stop().await;
}

#[tauri::command]
async fn send_msg(addr: String, msg: String) {
    fm_network::send(addr.into(), FMPacket::StringPacket { data: msg }).await;
}

#[tauri::command]
async fn query_play_histories() -> Result<String, String> {
    let mut category = HashMap::<String, String>::new();

    if let Ok(mut r) = read_dir(PLAY_HISTORY_PATH).await {
        let mut cache = PLAY_HISTORY_CACHE.write().await;
        let mut content = String::new();

        while let Ok(Some(dir_entry)) = r.next_entry().await {
            if let Some(path) = dir_entry.path().to_str() {
                match cache.entry(path.into()) {
                    Entry::Vacant(entry) => {
                        if let Ok(mut file) = File::open(path).await {
                            // read file if vacant, also write to category
                            // entry.insert(map) ...
                        }
                    }
                    Entry::Occupied(entry) => {/* write to category */}
                }
            }

            content.clear();
        }
    }

    if let Ok(string) = serde_json::ser::to_string(&category) {
        Ok(string)
    } else {
        Err("Failed query play history".into())
    }
}

#[tauri::command]
async fn get_history(key: String) -> Result<HashMap<String, Value>, ()> {
    let cache = PLAY_HISTORY_CACHE.read().await;

    if let Some(data) = cache.get(&key) {
        return Ok(data.to_owned());
    }

    Err(())
}
```

{% folding purple::🔨 %}

- `PLAY_HISTORY_CACHE` 是快取的學習歷程 `json string`，不然一直去 `file IO` 好像也不太好
- `query_play_histories()` 是取得目錄
- `get_history()` 是取得實際內容

{% endfolding %}

前端也把綁定寫在同一個檔案：

```ts RustBridge.tsx
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

let listening: Map<string, UnlistenFn> = new Map();

export interface MessageData<T> {
  payload: T;
}

export interface JPEGData {
  addr: string;
  data: [];
}

export interface ClientChangedData {
  add: string | null;
  remove: string | null;
}

export async function startUdp() {
  await invoke("start_udp");
}

export async function stopUdp() {
  await invoke("stop_udp");

  listening.forEach((unlisten) => unlisten());
  listening.clear();
}

export async function addClientChangeListener(
  id: string,
  cb: (data: ClientChangedData) => void
) {
  await addListener<ClientChangedData>(
    id + "_clientListener",
    "fm://client_changed",
    cb
  );
}

export async function addJpgDecodedListener(
  id: string,
  cb: (bytes: []) => void
) {
  await addListener<JPEGData>(
    id + "_jpegListener",
    "fm://jpeg_decoded",
    (data) => {
      if (data.addr == id) cb(data.data);
    }
  );
}

async function addListener<TData>(
  id: string,
  endpoint: string,
  cb: (data: TData) => void
) {
  listening.set(
    id,
    await listen(endpoint, (data) => {
      cb(data.payload as TData);
    })
  );
}

export async function send(addr: string, msg: string) {
  let arr = addr.split(":");
  console.log("Send", msg, "to", arr[0]);

  await invoke("send_msg", { addr: arr[0], msg: msg });
}

export async function query_play_history(): Promise<string> {
  return await invoke("query_play_histories");
}

export async function get_play_history(key: string | null | undefined) {
  if (typeof key === "string") {
    return await invoke("get_history", { key: key });
  }
}
```

{% folding purple::🔨 %}

- `@tauri-apps/api/core/invoke()` 呼叫後端方法
- `@tauri-apps/api/event/listen()` 訂閱後端的事件
- 呼叫 `listen()` 回傳的 `UnlistenFn` 就可以結束訂閱
- `listening` 就當作前端版本的訂閱管理了

{% endfolding %}

## React 部分

我不是前端專業，所以就是各種亂切版跟亂用。

需要提到的一部分是，因為啟動 `UDP` 應該是跟渲染沒關係的動作，應該用 `useEffect` 來完成：

```ts GameViewScreenBase.tsx
let clients: string[] = [];

export default function GameViewScreenBase({ com }) {
  const [clients, updateClients] = useState<string[]>([]);
  const [focusTarget, setFocusing] = useState<string>("");

  useEffect(() => {
    console.log("Initialize Network!");

    startUdp();
    addClientChangeListener("GameViewScreenBase", onClientChange);

    return () => {
      clients = [];
    }; // reset clients when exit
  }, [com.currentMode]); // dont re-call this if mode is not change

  // .
  // .
  // .
  // return (<>/* react node */</>);
}
```

解碼器的渲染元件也是一樣，不需要重新訂閱 `JPEGDecoded` 事件：

```ts DecoderView.tsx
interface Props {
  addr: string;
  setFocus?: ((addr: string) => void) | null;
}

export default function DecoderView({ addr, setFocus }: Props) {
  const [, setJpegVersion] = useState<number>(0);
  const [error, setError] = useState<boolean>(true);
  const [jpegUrls, updateJpegUrls] = useState<string[]>([]);

  function disposeAppend(arr: string[], newData?: string) {
    let url: string | undefined = undefined;
    while ((url = arr.pop())) {
      console.log("revoking URL", url);
      URL.revokeObjectURL(url);
    }
    if (newData) return [...arr, newData];
    else return arr;
  }

  useEffect(() => {
    if (addr === undefined) return;
    console.log("registering listener for", addr);
    addJpgDecodedListener(addr, (bytes) => {
      updateJpeg(bytes);
    });

    return () => {
      console.log(addr + " decoder view exited!");
      disposeAppend(jpegUrls);
    };
  }, [addr]);

  function updateJpeg(bytes: []) {
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);

    updateJpegUrls((prev) => disposeAppend(prev, url));

    setError(false);
    setJpegVersion((v) => v + 1);
  }

  return (
    <>
      <img
        src={
          error || addr === undefined
            ? fallbackImg
            : jpegUrls[jpegUrls.length - 1]
        }
        alt={addr}
        onError={() => setError(true)}
        onClick={() => setFocus && setFocus(addr)}
      />
    </>
  );
}
```

{% folding purple::🔨 %}

- 透過 `Blob` 就能把 `byte array` 當成 `jpeg` 使用
- 使用 `useEffect` 要注意觸發條件與返回函數
- `setJpegVersion` 就只是個觸發器，感覺可有可無
- `URL.revokeObjectURL()` 是必須的，用來釋放記憶體，不然 `Blob` 會一直存在記憶體中

{% endfolding %}

## 總結

用這個框架優點很明顯，應該說非常有個性，你要能屈能伸，同時在 `Rust` 編譯器底下乖乖寫程式，又可以在 `js` 端自由寫前端（沒有選 `ts` 為前提）。

其他的缺點，例如：編譯時間長、專案佔空間等等，這些 `Rust` 本來就有的缺點自然是逃不掉的，誰叫它編譯期就幫你把記憶體管好了呢？

`Rust` 提供了很高級的方式來完成底層操作，而 `Tauri` 就是為了解決 `Electron` 大包的問題而誕生，但現在硬碟就蠻便宜的，誰像我一樣天天硬碟空間告急？

說是提供了更好的安全性，但老話一句，使用者根本沒懂那麼多，對吧。

總之，也算是又做完了一個小的項目，填了個坑。

{% folding gray::🥳 %}

小菜我前端的部分真的不行，除了 `css` 寫得爛，之前沒認真用過 `React`，原來是這麼個回事啊。。。

題外話，這幾天都是離線開發，少了 `Copilot` 寫程式的小日子過得也是頗滋潤。

{% endfolding %}
