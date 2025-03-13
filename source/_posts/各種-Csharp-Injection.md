---
title: 各種-C#-Injection
date: 2025-03-11 15:24:57
tags: [Unity, C#]
---

### 問題點

練槍軟體專案 ALM 的回放機能一直難產，因為使用 PuerTs 給予熱更，本意是讓任務撰寫的自由度變高，但缺點就是沒辦法更好的捕捉程式碼步驟。

{% note purple %}
考慮過使用 `Command` 跟 `Event Bus` 的模式，雖然所有動作都可控，而且隨時要遷移到其他引擎都沒問題啦，但這樣不就等於重寫了一套 API 嗎？
{% endnote %}

可以在需要紀錄呼叫紀錄的方法內部增加 `RecordMethodCall()` 呼叫，例如我要記錄外部呼叫 `BallPoolService.Ball()` 這個方法（生成球）的時機點，就會像下面這樣：

```C#
// BallPoolService.cs
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

看起來有點愚蠢，另一方面是我很懶惰，想了想何不用 AOP 的思維用 `Attribute` 的方式來標示哪些方法需要紀錄？

### Harmony

`C#` 的反射有 `Emit` 命名空間，提供動態生成 `IL Code` 的功能，是非常酷的，但手刻 `IL Code` 痛苦面具給戴上了，為了減輕一袋米首先想到的是 `Harmony`，也就是製作 Mod 的老朋友，可以在執行階段進行非破壞性注入，同時沒那麼硬核的 `IL Coding` 美孜孜噠，馬上用 `NuGet` 給安排上，後來發現 `NuGet` 這個不適配 Unity，只好載 `Dll` 自己引用。

{% note red %}
這裡還有另一個問題，不知道為啥匯入 `0Harmony.dll` 後 vscode 端 `OmniSharp` 跑得巨慢，要記得選用 `net472` 版的 dll，`netstandard 2.1` 不認，會有 `PlatformNotSupport` 報錯
{% endnote %}

首先遇到的是 `API Level` 過低的問題，如果是用 `.NET Standard 2.1` 就不能使用 `Reflection.Emit` 命名空間，換到 `.NET Framwork` 能解決，那可以先寫一個 `Attribute`：

```C#
using System;

[AttributeUsage(AttributeTargets.Method)]
public class RecordMethodCallAttribute : Attribute
{
    public RecordMethodCallAttribute() { }
}
```

接著實作 Patch 的邏輯

```C#
// RecordService.cs

static bool _hasPatched; // 避免重複 Patch

public RecordService()
{
    if (!_hasPatched)
        Patch();
}

void Patch()
{
    var harmony = new Harmony("identifier");
    var targets = AppDomain.CurrentDomain.GetAssemblies()
        .SelectMany(x => x.GetTypes())
        .SelectMany(x => x.GetMethods((BindingFlags)int.MaxValue))
        .Where(x => x.GetCustomAttributes(typeof(RecordMethodCallAttribute), false).Length > 0);

    foreach (var target in targets)
    {
        var original = target;
        var prefix = typeof(RecordService).GetMethod(nameof(RecordMethodCall));
        harmony.Patch(original, new HarmonyMethod(prefix));
    }

    _hasPatched = true;
}

public static void RecordMethodCall(object __instance, MethodBase __originalMethod, object[] __args)
{
    var type = __instance.GetType();
    var method = __originalMethod.Name;
    var args = __args;

    // 用 Log 假裝寫入的動作
    UnityEngine.Debug.LogWarning($"{type} : {method} : {args}");
}
```

之後就可以把需要紀錄的方法都給加上 `Attribute`，例如剛才的 `BallService`：

```C#
// BallPoolService.cs
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

```C#
// RaycasterService.cs
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

### Mono.Cecil

透過 `Mono.Cecil` 把 `IL Code` 注入編譯後的 `Dll`
