---
title: 各種 C# Injection
date: 2025-03-11 15:24:57
tags: [Unity, C#]
excerpt: "文章介紹 C# 程式碼注入技術，從 Code Injection、Harmony 到 Mono.Cecil，並舉例說明如何在 Unity 專案中記錄方法呼叫，探討反射、IL 操作及自動化注入流程。"
---

有時會碰到外部 Dll 或是其他專案成員寫的框架，想在不破壞原始碼為前提更改邏輯，`Code Injection` 就能派上用場。

## 問題點

當然，前言只是以前困擾我的問題（以前實作的時候一直報錯），最近是因為我的練槍軟體專案 ALM 的回放機能一直難產，因為使用 PuerTs 給予熱更，本意是讓任務撰寫的自由度變高，但缺點就是沒辦法更好的捕捉程式碼步驟。

{% note purple %}
考慮過使用 `Command` 跟 `Event Bus` 的模式，多個中介層來記錄 `Message`，雖然所有動作都可控，而且隨時要遷移到其他引擎都沒問題啦，但這樣不就等於重寫了一套 API 嗎？有點違背這個專案的初衷。。。
{% endnote %}

先假設我有個 `RecordService` 提供記錄回放的邏輯，它有個方法是 `RecordMethodCall` 紀錄方法的呼叫：

```C# RecordService.cs
public class RecordService
{
    // 先不管內部邏輯的實現
    public void RecordMethodCall(
        System.Type serviceType,
        string methodName,
        params string[] parameters) { }
}
```

可以在需要紀錄呼叫的方法內部增加 `RecordMethodCall()` 呼叫，例如我要記錄外部呼叫 `BallPoolService.Ball()` 這個方法（生成球）的時機點，就會像下面這樣：

```C# BallPoolService.cs
readonly RecordService _recordService;
// .
// .
// .
public Ball Ball(int typeIndex = 0)
{
    _recordService.RecordMethodCall(
        typeof(BallPoolService),
        nameof(Ball),
        typeIndex.ToString());

    // Below is some logic not very important
    var ball = Pool.Get();
    ball.Color = _objectSetting.GetBallColor(typeIndex);
    ball.TypeIndex = typeIndex;
    return ball;
}
```

看起來有點愚蠢，一方面是我很懶惰，另一方面是假設哪天 `RecordMethodCall()` 改傳入參數或是擴充了其他多載，我不就需要全部引用的地方重寫？想了想何不用 AOP 的思維用 `Attribute` 的方式來標示哪些方法需要紀錄？

## Harmony

`C#` 的反射有 `Emit` 命名空間，提供動態生成 `IL Code` 的功能，是非常酷的，但手刻 `IL Code` 等於是自己把痛苦面具給戴上了，為了減輕一袋米首先想到的是 `Harmony`，也就是 Modding 的老朋友，可以在執行階段進行非破壞性注入，同時沒那麼多硬核的 `IL Coding` 美孜孜噠，馬上用 `NuGet` 給安排上，後來發現 `NuGet` 版不適配 Unity，只好載 `Dll` 自己引用。

{% note purple %}
我這裡用的是 [Harmony-Fat.2.3.5.0.zip](https://github.com/pardeike/Harmony/releases/tag/v2.3.5.0)，解壓後記得選用 `net472` 版的 dll，`netstandard 2.1` 會有 `PlatformNotSupport` 報錯。
{% endnote %}

{% note gray %}
題外話，不知道為啥匯入 `0Harmony.dll` 後 vscode 端 `OmniSharp` 跑得巨慢。。。
{% endnote %}

首先遇到的是 `API Level` 過低的問題，如果是用 `.NET Standard 2.1` 就不能使用 `Reflection.Emit` 命名空間，換到 `.NET Framework` 能解決：

![Api Compatibility Level](/images/各種-Csharp-Injection/api-level.png)

接著開始寫 `Attribute`：

```C# RecordMethodCallAttribute.cs
using System;

// 標示只能給方法使用
[AttributeUsage(AttributeTargets.Method)]
public class RecordMethodCallAttribute : Attribute
{
    public RecordMethodCallAttribute() { }
}
```

接著實作 Patch 的邏輯

```C# RecordService.cs
static bool _hasPatched; // 避免重複 Patch

// Constructor
public RecordService()
{
    if (!_hasPatched)
        Patch();
}

void Patch()
{
    // Harmony 進入點
    var harmony = new Harmony("identifier");
    // 反射出帶有 Attribute 的方法
    var targets = AppDomain.CurrentDomain.GetAssemblies()
        .SelectMany(x => x.GetTypes())
        .SelectMany(x => x.GetMethods((BindingFlags)int.MaxValue))
        .Where(x => x.GetCustomAttributes(typeof(RecordMethodCallAttribute), false).Length > 0);

    // 遍歷並 Patch
    var prefix = typeof(RecordService).GetMethod(nameof(RecordMethodCall));
    foreach (var target in targets)
        harmony.Patch(target, new HarmonyMethod(prefix));

    _hasPatched = true;
}

public static void RecordMethodCall(object __instance, MethodBase __originalMethod, object[] __args)
{
    var type = __instance.GetType();
    var method = __originalMethod.Name;
    var args = __args;

    // 用 Log 假裝紀錄的邏輯
    UnityEngine.Debug.LogWarning($"{type} : {method} : {args}");
}
```

之後就可以把需要紀錄的方法都給加上 `Attribute`，例如剛才的 `BallService.Ball()`：

```C# BallPoolService.cs
[RecordMethodCall]
public Ball Ball(int typeIndex = 0)
{
    var ball = Pool.Get();
    ball.Color = _objectSetting.GetBallColor(typeIndex);
    ball.TypeIndex = typeIndex;
    return ball;
}
```

更好的事情是，連私有的方法也可以加上，例如我有個做射線檢測的 `RaycasterService`：

{% note purple %}
使用反射的時候，覺得指定 `BindingFlags` 很麻煩的時候我都是寫 `(BindingFlags)int.MaxValue`，這個小技巧我稱之為全反射。
{% endnote %}

```C# RaycasterService.cs
[RecordMethodCall]
void _Cast(in Vector3 origin, in Vector3 direction, out IRaycastTarget target)
{
    target = default;
    if (Physics.Raycast(
        origin,
        direction,
        out var hit))
    {
        if (hit.transform.TryGetComponent<IRaycastTarget>(out target))
        {
            target.HitBy(0);
        }
    }
}
```

看起來很完美，唯一個問題是，目前專案是 `Mono Backend`，哪天改成 `il2cpp` 很難保證 `Harmony` 正常運行。

{% notel blue 為甚麼不正常？ %}
簡短說明一下：

- `Mono Backend` 使用 `JIT`，執行時透過 `Mono` 虛擬機將 `IL Code` 轉換成機器碼。
- `il2cpp` 使用 `AOT`，在編譯時將原本虛擬機要使用的 `IL Code` 轉換成 `C++` 程式碼，之後用目標平台的 `C++` 編譯器把轉換後的 `C++` 程式碼與 `libil2cpp`（執行階段庫）一併輸出。
  {% endnotel %}

## Mono.Cecil

`Mono.Cecil` 提供了竄改 `Dll` 的功能，同時也封裝了不少好用的方法降低 `IL Coding` 的難度。

透過把 `IL Code` 注入編譯後的 `Dll` 這個方法來實現屬於靜態程式碼，但我們的目的是不動到原始碼，同時目標方法更改的時候也只需要更改注入的邏輯就行了。

首先引入 `Mono.Cecil` 庫，看要用 `NuGet` 或是 `UPM`，甚至自己找 `Dll` 丟進 `Assets/Plugins/` 都可以。

我的主邏輯是寫在 `ALM` 的程序集內，這裡會將注入的邏輯放在另一個程序集內，由於注入只在打包階段完成，所以可以設定成 `Editor` 平台限定。

{% notel blue 為甚麼要放另一個程序集？ %}
`Mono.Cecil` 被廣泛運用在很多地方，有時會有版本衝突的問題（以作者的情況，`Mono.Cecil` 與 `Realm` 的庫衝突了），可以參考 {% post_link Unity-Dll-版本衝突 %}，所以獨立在一個程序集相對好管理引用。
{% endnotel %}

{% note purple %}
以下的程式碼會使用到 `UnityEditor` 命名空間，記得加上 `#if UNITY_EDITOR ... #endif` 的條件式編譯避免輸出時報錯。
{% endnote %}

先寫讀寫程序集的方法，讀：

```C# RecordCodeInjector.cs
static AssemblyDefinition _ReadAssembly(string assemblyPath)
{
    DefaultAssemblyResolver resolver = new();

    AppDomain.CurrentDomain.GetAssemblies()
        .Where(a => !a.IsDynamic)  // 跳過 Emit 生成的 Dynamic Assembly
        .Select(a => Path.GetDirectoryName(a.Location)) // 路徑
        .Distinct() // 移除重複
        .ToList()
        .ForEach(path => resolver.AddSearchDirectory(path));

    // Unity 的程序集
    resolver.AddSearchDirectory(
        Path.GetDirectoryName(EditorApplication.applicationPath) + "/Data/Managed");

    var readerParameters = new ReaderParameters
    {
        ReadWrite = true,
        AssemblyResolver = resolver
    };

    // 偵錯檔
    if (File.Exists(assemblyPath + ".pdb"))
        readerParameters.ReadSymbols = true;

    return AssemblyDefinition.ReadAssembly(
        assemblyPath, readerParameters);
}
```

{% note purple %}
`resolver.AddSearchDirectory()` 的部分是在處理跨程序集的操作。
{% endnote %}

寫：

```C# RecordCodeInjector.cs
static void _WriteAssembly(AssemblyDefinition assembly, string location)
{
    WriterParameters writerParameters = new();

    // 偵錯檔
    if (File.Exists(location + ".pdb"))
        writerParameters.WriteSymbols = true;

    assembly.Write(writerParameters);
}
```

{% note purple %}
`AssemblyDefinition.Write()` 原本需要提供路徑，但這裡是要寫入原本的 `Dll`，如果再給相同路徑會產生 `IOException: Sharing violation on path` 報錯（等於重複開了這個 `Dll`），直接呼叫就會覆蓋了。
{% endnote %}

實作注入流程的方法：

```C# RecordCodeInjector.cs
[MenuItem("ALM/Inject")]    // 編輯器手動注入測試
public static void Inject(string location = null)
{
    if (EditorApplication.isCompiling || Application.isPlaying)
        return;

    EditorApplication.LockReloadAssemblies();

    try
    {
        // 目標 Attribute
        var recordAttributeType = typeof(RecordMethodCallAttribute);
        location ??= recordAttributeType.Assembly.Location;

        var assembly = _ReadAssembly(location);
        var module = assembly.MainModule;

        // 避免重複 Inject，加入 flag type 檢查
        if (module.Types.Any(t => t.Name == "__INJECT_FLAG"))
        {
            assembly.MainModule?.Dispose();
            throw new(location + " already injected!");
        }

        // 宣告 flag type
        module.Types.Add(new(
            "__INJECT_CODE_GEN", "__INJECT_FLAG",
            Mono.Cecil.TypeAttributes.Class,
            module.TypeSystem.Object));

        // 同 Harmony 取得目標方法，但這裡要取得的是 MethodDefinition
        var targetMethods = module.Types
            .SelectMany(type => type.Methods)
            .Where(method => method.CustomAttributes
                .Any(attr => attr.AttributeType.FullName == recordAttributeType.FullName));

        // 遍歷並寫入 il
        foreach (var method in targetMethods)
            _InjectMethodBody(method);

        _WriteAssembly(assembly, location);

        assembly.MainModule?.Dispose();

        Debug.Log("[Injector] " + location + " has been injected!");
    }
    catch (Exception e)
    {
        Debug.LogError(e);
    }

    EditorApplication.UnlockReloadAssemblies();
    AssetDatabase.Refresh();
}
```

實際注入的 `IL Code` 定義在 `_InjectMethodBody()` 供日後修改：

```C# RecordCodeInjector.cs
static void _InjectMethodBody(MethodDefinition method)
{
    // 紀錄的方法
    var recordMethod = typeof(RecordService)
        .GetMethod(
            nameof(RecordService.RecordMethodCall),
            (BindingFlags)int.MaxValue);

    var il = method.Body?.GetILProcessor();

    if (il is null)
        return;

    var first = il.Body.Instructions[0];

    Queue<Instruction> insQueue = new();

    insQueue.Enqueue(Instruction.Create(
        OpCodes.Ldstr, method.FullName));
    insQueue.Enqueue(Instruction.Create(
        OpCodes.Call, method.Module.ImportReference(recordMethod)));

    while (insQueue.TryDequeue(out var ins))
        il.InsertBefore(first, ins);
}
```

{% folding gray::做了甚麼 %}

這裡的範例是將呼叫靜態方法 `RecordService.RecordMethodCall()`，並將 `method.FullName` 當作參數傳入。

```C# RecordService.cs
public static void RecordMethodCall(string info)
{
    // 用 Log 假裝紀錄的邏輯
    UnityEngine.Debug.Log(info);
}
```

{% note purple %}
`IL` 是基於棧操作的，寫起來會有點類似組語：

1. `ldstr` 將方法完整名稱壓棧
2. `call` 呼叫方法

實際情況需要看方法定義的參數，如果不是靜態方法的場合還需要注入 `field`，呼叫前也需要透過 `ldflda` 或 `ldfld` 將實體載入。
{% endnote %}

{% endfolding %}

最後要實作 `IPostBuildPlayerScriptDLLs` 介面，打包的時候自動注入：

```C#   PostBuildProcessor.cs
public class PostBuildProcessor : IPostBuildPlayerScriptDLLs
{
    public int callbackOrder => 0;

    public void OnPostBuildPlayerScriptDLLs(BuildReport report)
    {
        RecordCodeInjector.Inject(
            report.GetFiles().Single(x => x.path.EndsWith("ALM.dll")).path);
    }
}
```

打包出來，用 [dnSpy](https://github.com/dnSpy/dnSpy) 之類的逆向工程工具看看有沒有注入成功：

![after-injection](/images/各種-Csharp-Injection/after-injection.png)

## 後話

大概就是這樣，由於還是逆向工程的菜雞，很多知識點沒辦法敘述得很清楚，特別是 `IL` 指令根本就不太熟，哪天學成歸來再寫一篇分享。

{% note purple %}
非常推薦 [xLua](https://github.com/Tencent/xLua) 的 `Hotfix` 部分，這篇有不少地方參考它排雷以及實作注入邏輯。
{% endnote %}
