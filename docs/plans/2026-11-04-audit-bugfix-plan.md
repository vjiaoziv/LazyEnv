# LazyEnv 审计问题修复实施计划 (2026-11-04)

> **For Codex:** 按任务顺序逐个执行；每个任务 = 写失败测试 → 跑测试确认失败 → 实现 → 构建+测试通过 → 单独提交。禁止跨任务合并提交。

**Goal:** 修复 2026-11-04 全量代码审计发现的 23 项问题（F1-F23），消除数据丢失、命令注入、崩溃与正确性风险。

**Architecture:** 不引入新依赖、不重构架构；在现有 8 个 C++ 模块内做最小修改，新增测试全部追加到既有测试骨架（`test(name, cond)` 风格）。可单测的逻辑抽取为 public static 纯函数。

**Tech Stack:** C++23 / CMake / MSVC (VS18 BuildTools)、WebView2、原生 JS、自研测试骨架 + Node CDP E2E。

**基线:** 仓库 HEAD = `2f1b5cc`（working tree clean）。所有行号以该 commit 为准，修改后会漂移，请用上下文定位。

---

## 0. 执行约定

### 0.1 环境与精确命令（cmake 不在 PATH，必须全路径）

```powershell
$CMAKE = 'C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'
& $CMAKE --build D:\Git\LazyEnv\build --config Release --parallel   # 预期 exit 0，无 error

& D:\Git\LazyEnv\build\Release\test_v0814.exe    # 预期 0 failed（基线 26 passed）
& D:\Git\LazyEnv\build\Release\test_v090.exe     # 预期 0 failed（基线 37 passed）
node D:\Git\LazyEnv\tests\test_cdp_v090.mjs      # 预期 15 passed, 0 failed
node D:\Git\LazyEnv\tests\test_cdp_v0814.mjs     # 基线 11/13；T18 修复后预期 13/13
```

### 0.2 备份与回滚策略

AGENTS.md 的 `.bak_YYYYMMDD` 强制备份铁律仅适用于 docx/xlsx/pptx/pdf 文档操作，不适用代码。代码回滚保障：

1. 任务 T0.1 建分支 `codex/bugfix-audit-2026-11-04`，记录基线 SHA `2f1b5cc`
2. 每个任务一次提交，提交即检查点；出错用 `git checkout HEAD~1 -- <file>` 单文件回退
3. 永不 `git reset --hard`、永不 `git stash`

### 0.3 TDD 循环（每个代码任务固定五步）

1. 在 `tests/test_v090.cpp`（或指定测试文件）**先加失败测试**
2. 构建 + 运行，**确认该测试 FAIL**（新函数不存在导致编译错也算 FAIL，需记录）
3. 最小实现
4. 构建 + 全部测试，**确认 0 failed**
5. `git add <涉及文件> && git commit -m "<type>(<scope>): <描述>"`

无法可靠 fail-first 的任务（纯数据竞争、纯手工修改）在任务里显式标注"验证=代码审查+全量回归"，不伪造失败证据。

---

## 1. 任务总览

| 任务 | 发现 | 优先级 | 内容 | 状态 |
|---|---|---|---|---|
| T0.1 |||| [x] |
| T0.2 |||| [x] |
| T1 |||| [x] |
| T2 |||| [x] |
| T3 |||| [x] |
| T4a |||| [x] |
| T4b |||| [x] |
| T4c |||| [x] |
| T5 |||| [x] |
| T6 |||| [x] |
| T7 |||| [x] |
| T8 |||| [x] |
| T9 |||| [x] |
| T10 |||| [x] |
| T11 |||| [x] |
| T12 |||| [x] |
| T13 |||| [x] |
| T14 |||| [x] |
| T15 |||| [x] |
| T16 |||| [x] |
| T17 |||| [x] |
| T18 |||| [x] |
| T19 |||| [x] |
| T20 |||| [x] |
| T21 |||| [x] |
| T22 |||| [x] |
| T23 |||| [x] |
| T24 |||| [x] |
| T25 |||| [x] |
| T26 |||| [x] |
| T27 |||| [x] |

---

## Phase 0 - 准备

### T0.1 建分支并提交计划

**Objective:** 建立可回滚工作基线。

**Steps:**
1. `git status --short` → 只有本计划文件 untracked
2. `git checkout -b codex/bugfix-audit-2026-11-04`
3. `git add docs/plans/2026-11-04-audit-bugfix-plan.md`
4. `git commit -m "docs: add audit bugfix implementation plan (F1-F23)"`
5. 验证: `git log --oneline -1` 显示该提交，父为 `2f1b5cc`

### T0.2 基线复跑

**Objective:** 确认修复前状态，留作对照。
**Steps:** 执行 0.1 全部 5 条命令；结果记录到本文件末尾"基线记录"栏。预期与 0.1 一致；不一致则停下评估。

---

## Phase 1 - P0 数据安全与输入安全

### T1 (F1) 快照捕获不再因超长值静默截断

**Objective:** 注册表值超过缓冲区时跳过并**拒绝保存不完整快照**，杜绝"恢复时清空未捕获变量"。同时收紧为只捕获 REG_SZ/REG_EXPAND_SZ（与 T2 配套）。

**Files:**
- Modify: `rollback.h`（captureRegistryKey 签名，private 区）
- Modify: `rollback.cpp` captureRegistryKey（约 291-329 行）、createSnapshot（约 437-448 行）
- Test: `tests/test_v090.cpp`（新增 Test Group 11，插在 Test Summary 打印之前）

**Step 1 - 写失败测试:**

```cpp
    // -------------------------------------------------------------
    // Test Group 11: Oversized registry value capture (F1)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 11: Oversized registry value capture]\n";
    {
        std::string bigVal(200 * 1024, 'A');   // 200KB > 旧缓冲 32767 字节
        lazyenv::RollbackManager::writeEnvVariable("LazyEnvTestBigVar", bigVal, REG_SZ, false);
        lazyenv::RollbackManager rb;
        std::string sid = rb.createSnapshot("F1 big value");
        test("createSnapshot with 200KB value returns id", !sid.empty());
        if (!sid.empty()) {
            std::ifstream f(rb.getStorageDir() / (sid + ".json"), std::ios::binary);
            std::string json((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
            test("Oversized value captured in snapshot file",
                 json.find("LazyEnvTestBigVar") != std::string::npos);
            rb.deleteSnapshot(sid);
        }
        HKEY k = nullptr;
        if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Environment", 0, KEY_SET_VALUE, &k) == ERROR_SUCCESS) {
            RegDeleteValueW(k, L"LazyEnvTestBigVar");
            RegCloseKey(k);
        }
    }
```

**Step 2 - 验证失败:** 构建 + test_v090 → 预期 `[FAIL] Oversized value captured in snapshot file`（旧代码在该值处 break，文件无此变量）。

**Step 3 - 实现:**

`rollback.h` private 区改签名:
```cpp
    static std::vector<SnapshotEntry> captureRegistryKey(bool system,
                                                         bool* truncated = nullptr);
```

`rollback.cpp` captureRegistryKey 函数体（保留打开注册表逻辑，替换枚举循环）:
```cpp
    if (truncated) *truncated = false;
    DWORD index = 0;
    std::vector<BYTE> dataBuf(1024 * 1024);      // 1MB：覆盖注册表值实际上限
    wchar_t nameBuf[16384];
    while (true) {
        DWORD nameLen = static_cast<DWORD>(std::size(nameBuf));
        DWORD dataLen = static_cast<DWORD>(dataBuf.size());
        DWORD type    = 0;
        LONG  rc = RegEnumValueW(hKey, index, nameBuf, &nameLen,
                                 nullptr, &type, dataBuf.data(), &dataLen);
        if (rc == ERROR_MORE_DATA) {             // 超限：记录并跳过，绝不能 break
            if (truncated) *truncated = true;
            ++index;
            continue;
        }
        if (rc != ERROR_SUCCESS) break;          // ERROR_NO_MORE_DATA = 正常结束

        SnapshotEntry e;
        e.name = wideToUtf8(std::wstring(nameBuf, nameLen));
        e.type = type;
        if (type == REG_SZ || type == REG_EXPAND_SZ) {   // 只收字符串值（T2 配套）
            size_t wc = dataLen / sizeof(wchar_t);
            if (wc > 0 && reinterpret_cast<wchar_t*>(dataBuf.data())[wc - 1] == L'\0') --wc;
            e.value = wideToUtf8(std::wstring(reinterpret_cast<wchar_t*>(dataBuf.data()), wc));
            entries.push_back(std::move(e));
        }
        ++index;
    }
```
（需 `#include <vector>`；若 std::size 不便用，改 `sizeof(nameBuf)/sizeof(wchar_t)`。）

`rollback.cpp` createSnapshot:
```cpp
std::string RollbackManager::createSnapshot(const std::string& description) {
    Snapshot snap;
    snap.id          = generateId();
    snap.timestamp   = currentTimestamp();
    snap.description = description.empty() ? "Manual snapshot" : description;
    bool truncU = false, truncS = false;
    snap.user_env    = captureRegistryKey(false, &truncU);
    snap.system_env  = captureRegistryKey(true,  &truncS);
    if (truncU || truncS) return "";   // 拒绝保存不完整快照（宁可失败，不可数据丢失）
    if (!saveSnapshot(snap)) return "";
    return snap.id;
}
```

**Step 4 - 验证:** 构建 → test_v090 0 failed；test_v0814 0 failed（其 Group 2/3/4 依赖 createSnapshot，必须仍绿）。
**Step 5 - 提交:** `git commit -m "fix(rollback): skip oversized registry values and refuse truncated snapshots"`

---

### T2 (F2) 恢复快照不丢非字符串值 + 空快照拒绝

**Objective:** restoreRegistryKey 只删除/写入字符串值（DWORD 等原样保留）；空 user_env 快照拒绝恢复。

**Files:**
- Modify: `rollback.cpp` restoreRegistryKey（约 334-376 行）、restoreSnapshot（约 471 行起加守卫）
- Test: `tests/test_v090.cpp`（Test Group 12）
- 需 `#include <unordered_set>`

**Step 1 - 失败测试:**

```cpp
    std::cout << "\n[Test Group 12: Restore preserves non-string values + empty guard]\n";
    {
        // (a) DWORD 不应被恢复流程清掉
        HKEY k = nullptr;
        DWORD dv = 42;
        if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Environment", 0, KEY_SET_VALUE, &k) == ERROR_SUCCESS) {
            RegSetValueExW(k, L"LazyEnvTestDword", 0, REG_DWORD,
                           reinterpret_cast<const BYTE*>(&dv), sizeof(dv));
            RegCloseKey(k);
        }
        lazyenv::RollbackManager rb;
        std::string sid = rb.createSnapshot("F2 dword");
        test("snapshot with DWORD value created", !sid.empty());
        bool restoredOk = !sid.empty() && rb.restoreSnapshot(sid);
        test("restoreSnapshot succeeds", restoredOk);
        DWORD got = 0; DWORD sz = sizeof(got); DWORD typ = 0; bool present = false;
        if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Environment", 0, KEY_READ, &k) == ERROR_SUCCESS) {
            if (RegQueryValueExW(k, L"LazyEnvTestDword", nullptr, &typ,
                                 reinterpret_cast<BYTE*>(&got), &sz) == ERROR_SUCCESS
                && typ == REG_DWORD && got == 42) present = true;
            RegDeleteValueW(k, L"LazyEnvTestDword");
            RegCloseKey(k);
        }
        test("DWORD value survives restore", present);
        if (!sid.empty()) rb.deleteSnapshot(sid);

        // (b) 空 user_env 快照必须被拒绝
        lazyenv::RollbackManager rb2;
        std::string eid = "f2-empty-snapshot-test";
        std::ofstream ef(rb2.getStorageDir() / (eid + ".json"), std::ios::trunc);
        ef << "{\n  \"id\": \"" << eid << "\",\n  \"timestamp\": \"2026-11-04T00:00:00\",\n"
           << "  \"description\": \"empty\",\n  \"user_env\": [],\n  \"system_env\": []\n}\n";
        ef.close();
        bool emptyRestored = rb2.restoreSnapshot(eid);
        test("Empty snapshot restore is refused", !emptyRestored);
        rb2.deleteSnapshot(eid);
    }
```
fail-first: 旧代码 (a) 先删光全部值、再用 2 字节写 DWORD 失败 → DWORD 丢失 → FAIL；(b) 旧代码返回 true → FAIL。

**Step 2 - 实现 restoreRegistryKey:**

```cpp
bool RollbackManager::restoreRegistryKey(const std::vector<SnapshotEntry>& entries, bool system) {
    HKEY root = system ? HKEY_LOCAL_MACHINE : HKEY_CURRENT_USER;
    const wchar_t* subkey = system
        ? L"SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"
        : L"Environment";
    HKEY hKey = nullptr;
    if (RegOpenKeyExW(root, subkey, 0, KEY_READ | KEY_WRITE, &hKey) != ERROR_SUCCESS)
        return false;

    // 快照内字符串变量名集合（小写）；需在匿名空间加 toLowerCopy
    std::unordered_set<std::string> wanted;
    for (const auto& e : entries) wanted.insert(toLowerCopy(e.name));

    // 只删除「字符串类型 且 不在快照中」的值；DWORD/BINARY 一律保留
    {
        DWORD idx = 0;
        wchar_t buf[16384];
        while (true) {
            DWORD nameLen = static_cast<DWORD>(std::size(buf));
            LONG rc = RegEnumValueW(hKey, idx, buf, &nameLen,
                                    nullptr, nullptr, nullptr, nullptr);
            if (rc == ERROR_NO_MORE_DATA) break;
            if (rc == ERROR_MORE_DATA) { ++idx; continue; }
            if (rc != ERROR_SUCCESS) break;
            DWORD type = 0, cb = 0;
            if (RegQueryValueExW(hKey, buf, nullptr, &type, nullptr, &cb) == ERROR_SUCCESS
                && (type == REG_SZ || type == REG_EXPAND_SZ)) {
                std::string nm = wideToUtf8(std::wstring(buf, nameLen));
                if (wanted.find(toLowerCopy(nm)) == wanted.end())
                    RegDeleteValueW(hKey, buf);
            }
            ++idx;
        }
    }
    for (auto& e : entries) {
        if (e.type != REG_SZ && e.type != REG_EXPAND_SZ) continue;   // 不写非法尺寸的非字符串
        std::wstring wname = utf8ToWide(e.name);
        std::wstring wval  = utf8ToWide(e.value);
        DWORD dataSize = static_cast<DWORD>((wval.size() + 1) * sizeof(wchar_t));
        RegSetValueExW(hKey, wname.c_str(), 0, e.type,
                       reinterpret_cast<const BYTE*>(wval.c_str()), dataSize);
    }
    RegCloseKey(hKey);
    return true;
}
```

restoreSnapshot 在 loadSnapshot 之后加守卫:
```cpp
    if (snap.id.empty() || snap.timestamp.empty()) return false;
    if (snap.user_env.empty()) return false;   // 空快照恢复 = 清空环境，必须拒绝
```

**语义变化（刻意取舍）:** 快照里没有、但现在存在的字符串变量不会被删除（旧语义会删）。环境键内字符串变量都属本工具管辖，保留更安全；若回归不妥可回退本提交。

**Step 3/4/5:** 构建 → test_v090 0 failed（含 Group 11）→ test_v0814 0 failed → `git commit -m "fix(rollback): preserve non-string registry values on restore and refuse empty snapshots"`

---

### T3 (F3) recipe 配置恢复路径白名单

**Objective:** 堵住 targetDirMacro 未校验与 UNC/根定 relativePath 绕过，防恶意 .lazyenv 任意写文件。

**Files:**
- Modify: `recipe_manager.cpp` restoreConfigFiles 检查段（约 1378-1401 行）
- Test: `tests/test_v090.cpp`（Test Group 13）

**Step 1 - 失败测试:**

```cpp
    std::cout << "\n[Test Group 13: Recipe path security]\n";
    {
        namespace fs = std::filesystem;
        std::string tmpMacro = fs::temp_directory_path().string();   // 含 ':' 的绝对路径
        fs::path evilFile = fs::temp_directory_path() / "lazyenv_zipslip_test.txt";
        fs::remove(evilFile);

        lazyenv::RecipeConfigFile evil;
        evil.category = "test"; evil.name = "evil";
        evil.relativePath = "lazyenv_zipslip_test.txt";
        evil.targetDirMacro = tmpMacro;          // 非白名单宏（旧代码会写入！）
        evil.content = "pwned";
        std::vector<lazyenv::RecipeConfigFile> bad{ evil };
        lazyenv::RecipeManager::restoreConfigFiles(bad, "", nullptr);
        test("Non-whitelisted targetDirMacro is rejected", !fs::exists(evilFile));
        fs::remove(evilFile);

        // 根定路径绕过
        lazyenv::RecipeConfigFile rooted;
        rooted.category = "test"; rooted.name = "rooted";
        rooted.relativePath = "\\lazyenv_rooted_test.txt";
        rooted.targetDirMacro = "%USERPROFILE%";
        rooted.content = "pwned";
        std::vector<lazyenv::RecipeConfigFile> bad2{ rooted };
        std::error_code ec;
        fs::remove(fs::path("C:/lazyenv_rooted_test.txt"), ec);
        fs::remove(fs::path("D:/lazyenv_rooted_test.txt"), ec);
        lazyenv::RecipeManager::restoreConfigFiles(bad2, "", nullptr);
        test("Rooted relativePath is rejected",
             !fs::exists("C:/lazyenv_rooted_test.txt") && !fs::exists("D:/lazyenv_rooted_test.txt"));

        // 合法路径仍可用
        lazyenv::RecipeConfigFile okc;
        okc.category = "git"; okc.name = "cfg";
        okc.relativePath = ".lazyenv_sec_ok.txt";
        okc.targetDirMacro = "%USERPROFILE%";
        okc.content = "ok";
        std::vector<lazyenv::RecipeConfigFile> good{ okc };
        lazyenv::RecipeManager::restoreConfigFiles(good, "", nullptr);
        wchar_t up[1024] = {0};
        GetEnvironmentVariableW(L"USERPROFILE", up, 1024);
        fs::path okPath = fs::path(up) / ".lazyenv_sec_ok.txt";
        test("Allowed macro still restored", fs::exists(okPath));
        fs::remove(okPath);
    }
```
fail-first: 旧代码对 tmpMacro 不校验 → 写入 temp 文件 → 第 1 条断言 FAIL。

**Step 2 - 实现（restoreConfigFiles 检查段替换）:**

```cpp
        // 白名单：只允许这两个目录宏
        if (c.targetDirMacro != "%USERPROFILE%" && c.targetDirMacro != "%APPDATA%") {
            if (onLog) onLog("[LazyEnv] Security: skipped non-whitelisted targetDirMacro: " + c.targetDirMacro);
            continue;
        }
        std::string relNorm = c.relativePath;
        for (char& ch : relNorm) { if (ch == '/') ch = '\\'; }
        if (relNorm.empty() || relNorm == ".." ||
            relNorm.starts_with("\\") ||              // 根定 & UNC 一并拒绝
            relNorm.find(':') != std::string::npos ||
            relNorm.find("..\\") != std::string::npos ||
            relNorm.find("\\..") != std::string::npos) {
            if (onLog) onLog("[LazyEnv] Security: skipped suspicious relative path: " + c.relativePath);
            continue;
        }
```
随后 baseDir 三分支收敛为两分支（%APPDATA% 用 appData，%USERPROFILE% 用 userProfile——白名单已保证不会有第三种）。

**Step 3/4/5:** 构建 → test_v090 0 failed（既有 Group 5 配置恢复仍绿）→ `git commit -m "fix(recipe): whitelist target macros and block rooted/UNC config paths"`

---
### T4a (F4) shell 输入校验三件套（public static 纯函数）

**Objective:** 为所有拼接 shell 命令的位置提供统一白名单校验。

**Files:**
- Modify: `installer.h`（public 区 ~105-135 附近加 3 个声明）
- Modify: `installer.cpp`（实现）
- Test: `tests/test_v090.cpp`（Test Group 14）
- 需 `#include <cstring>`

**Step 1 - 失败测试（新函数不存在 => 编译错误即 FAIL，记录编译错误）:**

```cpp
    std::cout << "\n[Test Group 14: Shell input validation]\n";
    test("Safe package id accepted",
         lazyenv::Installer::isSafePackageId("Python.Python.3.12") &&
         lazyenv::Installer::isSafePackageId("@vue/cli"));
    test("Unsafe package id rejected",
         !lazyenv::Installer::isSafePackageId("x\" & calc") &&
         !lazyenv::Installer::isSafePackageId("a|b"));
    test("Mirror url whitelist",
         lazyenv::Installer::isSafeMirrorUrl("https://registry.npmmirror.com") &&
         !lazyenv::Installer::isSafeMirrorUrl("https://x.com/\"&calc") &&
         !lazyenv::Installer::isSafeMirrorUrl("ftp://x") &&
         !lazyenv::Installer::isSafeMirrorUrl("https://x/%PATH%"));
    test("Shell token rejection",
         lazyenv::Installer::isSafeShellToken("python --version") &&
         !lazyenv::Installer::isSafeShellToken("foo & del /q C:\\*") &&
         !lazyenv::Installer::isSafeShellToken("a\"b") &&
         !lazyenv::Installer::isSafeShellToken("x%y"));
```

**Step 2 - 实现:**

```cpp
// installer.h (public 区)
    // 输入安全：外部字符串进入 shell 命令前的白名单校验
    static bool isSafePackageId(const std::string& id);    // 字母数字 . _ - / @ +
    static bool isSafeMirrorUrl(const std::string& url);   // http(s)://，字符白名单，禁 " % 控制符
    static bool isSafeShellToken(const std::string& s);    // 禁 & | < > ^ % " ! 与控制符
```

```cpp
// installer.cpp
bool Installer::isSafePackageId(const std::string& id) {
    if (id.empty() || id.size() > 200) return false;
    for (unsigned char c : id)
        if (!(std::isalnum(c) || c=='.' || c=='_' || c=='-' || c=='/' || c=='@' || c=='+'))
            return false;
    return true;
}
bool Installer::isSafeMirrorUrl(const std::string& url) {
    auto hasPrefix = [&](const char* p){ return url.rfind(p, 0) == 0; };
    if (!hasPrefix("http://") && !hasPrefix("https://")) return false;
    if (url.size() > 500) return false;
    for (unsigned char c : url) {
        if (c < 0x20 || c == 0x7F) return false;
        if (c == '"' || c == '%' || c == '`') return false;   // % 可参与环境变量展开
        if (!(std::isalnum(c) || strchr("._~:/?#=@!$&'()*+,;-", c))) return false;
    }
    return true;
}
bool Installer::isSafeShellToken(const std::string& s) {
    if (s.empty() || s.size() > 300) return false;
    for (unsigned char c : s) {
        if (c < 0x20 || c == 0x7F) return false;
        if (strchr("&|<>^%\"!`", c)) return false;
    }
    return true;   // 允许空格：display name 含空格合法
}
```

**已知取舍:** isSafeMirrorUrl 禁 `%`，因此 `https://host/a%20b` 这类编码 URL 会被拒（镜像源几乎不用；比放任 `%PATH%` 展开安全）。probeCommand 走 isSafeShellToken，拒绝 `&|%` 等——探测命令本应是单条命令。

**Step 3/4/5:** 构建 + 全测 0 failed -> `git commit -m "feat(security): add shell input validators (package id / mirror url / token)"`

---

### T4b (F4) C++ 侧调用点接入

**Objective:** 所有外部输入进 shell 前校验。**只改下表这些点，不扩散。**

**Files:** `main.cpp`、`installer.cpp`、`package_manager.cpp`

| 位置 | 改法 |
|---|---|
| main.cpp setMirrorSource（约 1403-1412） | 起线程前: `if (!lazyenv::Installer::isSafeMirrorUrl(url)) return "{\"action\":\"mirrorSourceSetResult\",\"success\":false}";` |
| main.cpp probeCommand（约 658-669） | 起线程前: 不安全则直接返回 `{"action":"probeResult","found":false,...,"message":"Unsafe command characters."}`（command 字段用 jsonEscape） |
| main.cpp install（约 1629-1652） | 循环内: `if (!Installer::isSafePackageId(pkg.id))` -> statusStr="failed"，message "Unsafe package id"，continue |
| main.cpp retryInstall（约 1721-1739） | 同上: 不安全 id 直接 post 一条 failed 的 installProgress |
| main.cpp uninstallPackage（约 673-711） | displayName 用 isSafeShellToken 校验（空格可过）；不通过走 catch 同款失败响应 |
| installer.cpp installPackage（约 211-214） | `if (!isSafePackageId(pkg.id)) { result.status=Failed; result.output="Unsafe package id"; return result; }` |
| installer.cpp upgradeEnvironment（约 401-416） | packageId 非空时同上校验；--name 分支校验 displayName |
| package_manager.cpp WingetProvider::upgrade（约 193-195） | `if (!Installer::isSafePackageId(packageId))` -> Failed + reason（保留 interactive 分支） |

**验证:** 构建 + 全测 0 failed + 审查: `Select-String -Path *.cpp -Pattern 'install --id|upgrade --id'` 确认每个点上游有校验。
**提交:** `git commit -m "fix(security): validate external inputs before shell execution"`

---

### T4c (F4) recipe 部署侧接入

**Files:** `recipe_manager.cpp` deployRecipe 镜像与包安装段（约 1615-1663）

- 镜像两处（npm/pip config set）: `if (Installer::isSafeMirrorUrl(diff.mirrors.npm)) { runCommand(...) } else if (onLog) onLog("skip unsafe npm mirror");`
- 每个 `p.id` 装包前: `if (!Installer::isSafePackageId(p.id)) { if (onLog) onLog("skip unsafe package id: " + p.id); continue; }`

**验证:** 构建 + test_v090 0 failed（Group 1/4 正常 recipe 不受影响）。
**提交:** `git commit -m "fix(recipe): validate package ids and mirrors before deployment"`

---

### T5 (F5) 两处数据竞争加锁 + 并发压测

**Objective:** 修复 generateId PRNG 与 getWingetExecutable 静态缓存的无锁并发（HEAD 提交声称已修但代码无锁）。

**Files:** `rollback.cpp`（include 区 + generateId 约 618-627）、`installer.cpp`（getWingetExecutable 约 157-186）、`tests/test_v090.cpp`（Test Group 15）

**Step 1 - 压测测试（回归护栏；race 类无法保证 fail-first，如实标注）:**

```cpp
    std::cout << "\n[Test Group 15: Concurrency guards]\n";
    {
        std::mutex m; std::vector<std::string> ids;
        std::vector<std::thread> ths;
        for (int t = 0; t < 4; t++) ths.emplace_back([&]() {
            lazyenv::RollbackManager rb;
            for (int i = 0; i < 50; i++) {
                std::string id = rb.createSnapshot("stress");
                if (!id.empty()) { std::lock_guard<std::mutex> lk(m); ids.push_back(id); }
            }
        });
        for (auto& th : ths) th.join();
        std::sort(ids.begin(), ids.end());
        bool uniq = std::adjacent_find(ids.begin(), ids.end()) == ids.end();
        test("Concurrent snapshot ids unique", ids.size() == 200 && uniq);
        lazyenv::RollbackManager rb;
        for (auto& id : ids) rb.deleteSnapshot(id);

        std::mutex m2; std::set<std::string> seen;
        std::vector<std::thread> ths2;
        for (int t = 0; t < 4; t++) ths2.emplace_back([&]() {
            for (int i = 0; i < 50; i++) {
                std::string v = lazyenv::Installer::getWingetExecutable();
                std::lock_guard<std::mutex> lk(m2); seen.insert(v);
            }
        });
        for (auto& th : ths2) th.join();
        test("Concurrent getWingetExecutable stable", seen.size() == 1);
    }
```
（测试文件头补 `#include <thread>` `<set>` `<mutex>`。200 个快照的创建/删除约数秒，属预期。）

**Step 2 - 实现:**

```cpp
// rollback.cpp
static std::mutex s_rngMutex;   // 放匿名空间
std::string RollbackManager::generateId() {
    static std::mt19937 rng(std::random_device{}());
    std::lock_guard<std::mutex> lock(s_rngMutex);
    ... 原体不动 ...
}
```
```cpp
// installer.cpp
static std::mutex s_wingetCacheMutex;
std::string Installer::getWingetExecutable() {
    static std::string cached;
    std::lock_guard<std::mutex> lock(s_wingetCacheMutex);
    if (!cached.empty()) return cached;
    ... 原体不动（isCommandAvailable 在锁内跑一次子进程，仅首次，可接受）...
}
```

**Step 3/4/5:** 构建 + 全测 0 failed -> `git commit -m "fix(core): serialize PRNG and winget executable cache across threads"`

---
## Phase 2 - P1 稳定性

### T6 (F6) spawnGuarded 统一线程异常防护

**Objective:** 消除 8 个裸 `std::thread().detach()` 的异常逃逸（异常 => std::terminate 崩溃）。

**Files:** `main.cpp`（helper + 8 处替换）；8 处锚点: exportMigrationRecipe 线程(约 869)、exportRecipeDialog(约 934)、importRecipeDialog(约 989)、exportDoctorReportDialog(约 1309)、install(约 1633)、retryInstall(约 1725)、exportSnapshot(约 1846)、importSnapshot(约 1903)

**Step 1 - 实现**（放 handleWebMessage 定义之前；需 `#include <functional>`）:

```cpp
// 后台任务统一防护：任何异常转成 error 消息，绝不让 std::thread 逃逸导致 terminate
static void spawnGuarded(const char* tag, std::function<void()> fn) {
    std::thread([tag, fn = std::move(fn)]() {
        try {
            fn();
        } catch (const std::exception& e) {
            g_webview.postMessage(std::format(
                "{{\"action\":\"error\",\"message\":\"{}: {}\"}}", tag, jsonEscape(e.what())));
        } catch (...) {
            g_webview.postMessage(std::format(
                "{{\"action\":\"error\",\"message\":\"{}: unknown error\"}}", tag));
        }
    }).detach();
}
```

替换模板（以 exportMigrationRecipe 为例）:
```cpp
        spawnGuarded("Recipe export", [owner, rName, rDesc, rAuthor, incPkgs, incVars, incCfgs, incExts]() {
            ...原线程体原样搬入...
        });
        return "{\"action\":\"exportRecipeStarted\"}";
```
8 处 tag: `"Recipe export"`、`"Recipe export"`、`"Recipe import"`、`"Doctor report export"`、`"Package install"`、`"Package retry"`、`"Snapshot export"`、`"Snapshot import"`。

**Step 2 - 验证（无法 fail-first，验证=审查+回归）:**
1. `Select-String -Path main.cpp -Pattern 'std::thread\('` -> 每处要么已被 spawnGuarded 替换，要么 lambda 内自带 try/catch（detectEnvironments/probe/uninstall/updates/doctor/mirror 等既有线程）
2. 构建 + 全测 0 failed + 2 个 CDP 全绿

**提交:** `git commit -m "fix(core): guard all detached worker threads against exceptions"`

---

### T7 (F7) g_lastImportedRecipe 加锁

**Files:** `main.cpp` 全局声明区(约 65)、importRecipeDialog 写点(约 1018)、deployRecipe 读点(约 1106-1109)

```cpp
static std::mutex g_recipeMutex;   // 放 g_lastImportedRecipe 旁
// 写点（导入线程）:
{ std::lock_guard<std::mutex> lk(g_recipeMutex); g_lastImportedRecipe = recipe; }
// 读点（部署线程进 lambda 后立即拷贝）:
lazyenv::EnvironmentRecipe baseRecipe;
{ std::lock_guard<std::mutex> lk(g_recipeMutex); baseRecipe = g_lastImportedRecipe; }
// 1106-1109 改用 baseRecipe.configFiles / ideExtensions / environmentVariables / paths
```
**验证:** 构建 + 全测 + 2 个 CDP（审查时序）。**提交:** `git commit -m "fix(core): synchronize imported recipe access"`

---

### T8 (F10) webview_host 异常消息 JSON 转义

**Files:** `webview_host.cpp` 约 177 行

匿名空间加局部 `jsonEscape`（复制 rollback.cpp:42-70 的实现），177 行改为:
```cpp
std::string errJson = std::string("{\"action\":\"error\",\"message\":\"")
                    + jsonEscape(e.what()) + "\"}";
```
**验证:** 构建 + 全测（无自动测试，审查确认）。**提交:** `git commit -m "fix(webview): escape exception text in error JSON"`

---

### T9 (F16) restoreSnapshot 异步化

**Files:** `main.cpp` restoreSnapshot 分支（约 1823-1828）

```cpp
    if (action == "restoreSnapshot") {
        std::string id = extractJsonValue(message, "snapshotId");
        spawnGuarded("Snapshot restore", [id]() {
            bool ok = g_rollback.restoreSnapshot(id);
            g_webview.postMessage(std::format(
                "{{\"action\":\"restoreResult\",\"success\":{},\"snapshotId\":\"{}\"}}",
                ok ? "true" : "false", jsonEscape(id)));
        });
        return "";   // JS 的 case "restoreResult" 本就是异步事件处理
    }
```
（依赖 T6 的 spawnGuarded，故必须在 T6 之后。）
**验证:** 构建 + 2 个 CDP 全绿。**提交:** `git commit -m "fix(core): run snapshot restore off the UI thread"`

---

### T10 (F17) 单实例保护

**Files:** `main.cpp` wWinMain（约 2241 行起，DPI 设置之后）

```cpp
    HANDLE hSingle = CreateMutexW(nullptr, FALSE, L"LazyEnv.SingleInstance");
    if (hSingle && GetLastError() == ERROR_ALREADY_EXISTS) {
        if (HWND existing = FindWindowW(kWindowClass, nullptr)) {
            if (IsIconic(existing)) ShowWindow(existing, SW_RESTORE);
            SetForegroundWindow(existing);
        }
        if (hSingle) CloseHandle(hSingle);
        return 0;
    }
    // 函数各 return 前: if (hSingle) CloseHandle(hSingle);
```
**验证（手动，如实记录）:**
1. 启动 `build\Release\LazyEnv.exe`
2. 再启动一次 -> 第二个进程立即退出、第一个窗口到前台（`Get-Process LazyEnv | Measure-Object` 数量为 1）
3. 关闭全部实例

**提交:** `git commit -m "fix(core): enforce single instance and focus existing window"`

---

### T11 (F9) file URI 百分号编码 + 路径冒烟 E2E

**Objective:** 安装路径含 `%`、`#`、`?`、空格、非 ASCII 时页面仍能加载。Chromium 会自动编码空格/Unicode，但 `%`/`#`/`?` 会被当转义/fragment/query 语义，必须显式编码。

**Files:** `main.cpp` getHtmlUri（约 265-279）；新建 `tests/test_cdp_path_smoke.mjs`

**Step 1 - 复现（fail-first 手动）:** 按 Step 3 的脚本先对未修复 exe 跑一次，预期 sidebar 版本读不到/白屏；若 Chromium 恰好容忍则记录"未复现"，仍实施编码（防御性正确性修复）。

**Step 2 - 新建 `tests/test_cdp_path_smoke.mjs`（完整脚本）:**

```js
import { spawn } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
const SRC = 'D:\\Git\\LazyEnv\\build\\Release';
const DIR = 'D:\\Git\\LazyEnv 测试%#';
const PORT = 9258;
rmSync(DIR, { recursive: true, force: true });
cpSync(SRC, DIR, { recursive: true });
const proc = spawn(DIR + '\\LazyEnv.exe', [], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
  stdio: 'ignore'
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
try {
  let wsUrl = null;
  for (let i = 0; i < 25 && !wsUrl; i++) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
      }
    } catch {}
  }
  if (!wsUrl) throw new Error('no CDP endpoint');
  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (method, params = {}) => new Promise(resolve => {
    const reqId = id++;
    const h = ev => { const m = JSON.parse(ev.data); if (m.id === reqId) { ws.removeEventListener('message', h); resolve(m.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: reqId, method, params }));
  });
  await send('Runtime.enable');
  await sleep(1500);
  const r = await send('Runtime.evaluate', {
    expression: "document.querySelector('.sidebar__version')?.textContent || ''",
    returnByValue: true
  });
  const ver = r?.result?.value || '';
  const ok = ver.includes('v0.');
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] Page loads from path with spaces/%/# - got: "${ver}"`);
  if (!ok) failed++;
  ws.close();
} catch (e) {
  console.error('  [FAIL] smoke error:', e.message); failed++;
} finally {
  proc.kill();
  rmSync(DIR, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
```

**Step 3 - 实现编码（getHtmlUri 替换）:**

推荐实现（整串转 UTF-8 再逐字节编码，代理对自然正确）:
```cpp
static std::wstring encodeFileUri(const std::wstring& absPath) {
    // 1) 全串 wide -> utf8（wideToUtf8 已存在于 main.cpp 匿名空间）
    std::string utf8 = wideToUtf8(absPath);
    for (auto& ch : utf8) if (ch == '\\') ch = '/';
    // 2) 逐字节，需编码字符输出 %XX
    std::wstring out = L"file:///";
    for (unsigned char b : utf8) {
        if (b == ' ' || b == '%' || b == '#' || b == '?' || b > 127) {
            char hex[4]; snprintf(hex, sizeof(hex), "%%%02X", b);
            out += hex;   // wchar_t 从 ASCII 拷贝
        } else out += static_cast<wchar_t>(b);
    }
    return out;
}
std::wstring getHtmlUri() {
    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(nullptr, exePath, MAX_PATH);
    std::filesystem::path htmlPath =
        std::filesystem::path(exePath).parent_path() / "resources" / "index.html";
    return encodeFileUri(htmlPath.wstring());
}
```
（`snprintf` 需 `<cstdio>`；若 main.cpp 未含则补。）

**Step 4/5:** 构建 -> `node tests\test_cdp_path_smoke.mjs` PASS + 既有 2 个 CDP 全绿 -> `git commit -m "fix(core): percent-encode file URI and add path smoke E2E"`

---

### T12 (F8) openUrl 白名单 + 宽字符

**Files:** `main.cpp` openUrl 分支（约 1538-1544）

```cpp
    if (action == "openUrl") {
        std::string url = extractJsonValue(message, "url");
        bool ok = false;
        auto starts = [&](const char* p){ return url.rfind(p, 0) == 0; };
        if (starts("http://") || starts("https://") || starts("mailto:")) {
            HINSTANCE hi = ShellExecuteW(NULL, L"open", utf8ToWide(url).c_str(),
                                         NULL, NULL, SW_SHOWNORMAL);
            ok = (reinterpret_cast<INT_PTR>(hi) > 32);
        }
        return std::format("{{\"action\":\"openUrlResult\",\"success\":{}}}", ok ? "true" : "false");
    }
```
**验证:** 构建 + CDP v090（含官方文档按钮路径）全绿；审查 JS 侧 openUrl 的 url 来源均为硬编码官方域名 + data-url。
**提交:** `git commit -m "fix(core): restrict openUrl to http(s)/mailto and use wide API"`

---
## Phase 3 - P2 正确性

### T13 (F11) winget 更新匹配收紧

**Objective:** 消除子串匹配误报（命令 `go` 会命中 "Google Chrome" 包）。

**Files:** `installer.h`（public 声明）、`installer.cpp` checkUpdates 匹配循环（约 317-336）、`tests/test_v090.cpp`（Group 16）

**Step 1 - 失败测试:**

```cpp
    std::cout << "\n[Test Group 16: Winget update matching]\n";
    test("'go' must not match Google Chrome entry",
         !lazyenv::Installer::wingetEntryMatches("go", "Go",
             "", "Google.Chrome", "Google Chrome"));
    test("'go' matches GoLang.Go via id segment",
         lazyenv::Installer::wingetEntryMatches("go", "Go",
             "", "GoLang.Go", "Go"));
    test("exact package id wins",
         lazyenv::Installer::wingetEntryMatches("python", "Python",
             "python.python.3.12", "Python.Python.3.12", "Python 3.12"));
    test("exact name match",
         lazyenv::Installer::wingetEntryMatches("git", "Git", "", "Git.Git", "Git"));
```

**Step 2 - 实现:**

```cpp
// installer.h (public)
    static bool wingetEntryMatches(const std::string& cmdLower,
                                   const std::string& nameLower,
                                   const std::string& packageIdLower,   // 已知包 id 小写（可空）
                                   const std::string& entryId,
                                   const std::string& entryName);
```
```cpp
// installer.cpp
bool Installer::wingetEntryMatches(const std::string& cmdLower,
                                   const std::string& nameLower,
                                   const std::string& packageIdLower,
                                   const std::string& entryId,
                                   const std::string& entryName) {
    std::string eid = toLower(entryId), ename = toLower(entryName);
    if (!packageIdLower.empty() && eid == packageIdLower) return true;   // 精确 id
    if (eid == cmdLower) return true;                                    // id 就是命令名
    auto dot = eid.rfind('.');                                           // id 末段 == 命令名
    if (dot != std::string::npos && eid.substr(dot + 1) == cmdLower) return true;
    if (!ename.empty() && ename == nameLower) return true;               // 精确名称
    return false;                                                        // 一切子串包含删除
}
```
checkUpdates 匹配循环替换:
```cpp
            for (const auto& wEntry : wingetUpgrades) {
                if (wingetEntryMatches(cmdLower, nameLower, toLower(info.packageId),
                                       wEntry.id, wEntry.name)) {
                    info.packageId     = wEntry.id;
                    info.latestVersion = wEntry.available;
                    info.hasUpdate     = true;
                    info.updateSource  = "winget";
                    matched            = true;
                    break;
                }
            }
```
**Step 3/4/5:** 构建 + 全测 + 2 个 CDP -> `git commit -m "fix(update): replace substring winget matching with exact/segment rules"`

---

### T14 (F12) 关键环境变量删除保护

**Files:** `rollback.h`（public static 声明）、`rollback.cpp`（实现）、`main.cpp` deleteEnvVar（约 2061-2070）、`tests/test_v090.cpp`（Group 17）

**Step 1 - 失败测试:**

```cpp
    std::cout << "\n[Test Group 17: Critical env var protection]\n";
    test("Critical vars protected",
         lazyenv::RollbackManager::isCriticalEnvVar("Path") &&
         lazyenv::RollbackManager::isCriticalEnvVar("PATHEXT") &&
         lazyenv::RollbackManager::isCriticalEnvVar("TEMP") &&
         lazyenv::RollbackManager::isCriticalEnvVar("USERPROFILE") &&
         lazyenv::RollbackManager::isCriticalEnvVar("ProgramFiles(x86)"));
    test("Ordinary var not protected",
         !lazyenv::RollbackManager::isCriticalEnvVar("MY_TOOL_HOME"));
```

**Step 2 - 实现:**

```cpp
// rollback.h (public)
    static bool isCriticalEnvVar(const std::string& name);
// rollback.cpp
bool RollbackManager::isCriticalEnvVar(const std::string& name) {
    static const char* kCritical[] = {
        "path", "pathext", "systemroot", "windir", "comspec", "systemdrive",
        "userprofile", "homedrive", "homepath", "appdata", "localappdata",
        "programdata", "programfiles", "programfiles(x86)", "programw6432",
        "temp", "tmp", "public", "username", "userdomain", "psmodulepath",
        "os", "number_of_processors", "processor_architecture"
    };
    std::string n = name;
    for (auto& c : n) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    for (auto* c : kCritical) if (n == c) return true;
    return false;
}
```
main.cpp deleteEnvVar 的 4 个手写判断替换为 `if (lazyenv::RollbackManager::isCriticalEnvVar(name)) { ...原样失败响应... }`。
**提交:** `git commit -m "fix(core): broaden critical environment variable delete protection"`

---

### T15 (F13) autoClean 成功判定

**Files:** `path_doctor.h`（public static）、`path_doctor.cpp`（实现 + 约 339-340 调用处）、`tests/test_v090.cpp`（Group 18）

**Step 1 - 失败测试:**

```cpp
    std::cout << "\n[Test Group 18: autoClean success logic]\n";
    test("User-clean-disabled does not fail overall",
         lazyenv::PathDoctor::computeAutoCleanSuccess(false, true, false, true, false, true));
    test("Requested clean that failed reports failure",
         !lazyenv::PathDoctor::computeAutoCleanSuccess(true, true, false, true, false, true));
    test("No changes reports success",
         lazyenv::PathDoctor::computeAutoCleanSuccess(true, false, false, true, false, false));
```

**Step 2 - 实现:**
```cpp
// path_doctor.h (public)
    static bool computeAutoCleanSuccess(bool cleanUser, bool userChanged, bool userCleaned,
                                        bool cleanSystem, bool sysChanged, bool sysCleaned);
// path_doctor.cpp
bool PathDoctor::computeAutoCleanSuccess(bool cleanUser, bool userChanged, bool userCleaned,
                                         bool cleanSystem, bool sysChanged, bool sysCleaned) {
    return (!cleanUser   || !userChanged   || userCleaned) &&
           (!cleanSystem || !sysChanged    || sysCleaned);
}
// autoClean 339-340 改为:
result.success = computeAutoCleanSuccess(cleanUser, userChanged, result.userCleaned,
                                         cleanSystem, sysChanged, result.systemCleaned);
```
**提交:** `git commit -m "fix(doctor): correct autoClean success evaluation"`

---

### T16 (F14) switchActiveVersion 三处修复

**Files:** `path_doctor.cpp` switchActiveVersion（约 404-470）、`tests/test_v090.cpp`（Group 19）

**Step 1 - 失败测试（幂等不建快照）:**

```cpp
    std::cout << "\n[Test Group 19: switchActiveVersion idempotency]\n";
    {
        namespace fs = std::filesystem;
        fs::path tmp = fs::temp_directory_path() / "lazyenv_switch_test_bin";
        fs::create_directories(tmp);
        std::string tmpA = tmp.string();
        std::string origPath = lazyenv::RollbackManager::readEnvVariable("Path", false);
        lazyenv::RollbackManager::writeEnvVariable("Path", tmpA + ";" + origPath,
                                                    REG_EXPAND_SZ, false);
        lazyenv::RollbackManager rb;
        std::string sid;
        bool ok = lazyenv::PathDoctor::switchActiveVersion("python", tmpA, rb, sid);
        test("Idempotent switch succeeds", ok);
        test("Idempotent switch creates no snapshot", sid.empty());
        lazyenv::RollbackManager::writeEnvVariable("Path", origPath, REG_EXPAND_SZ, false);
        lazyenv::RollbackManager::broadcastEnvironmentChange();
        fs::remove_all(tmp);
    }
```
fail-first: 旧代码无条件建快照 -> 第 2 条 FAIL。（写 PATH 已有还原保护；测试顺序执行不可中断。）

**Step 2 - 实现（404-470 重排）:**
1. 先算 newPath（现 425-438 逻辑提前到建快照之前），加幂等短路:
```cpp
    if (newPath == raw) { outSnapshotId = ""; return true; }
```
2. 再建快照（现 415 行移到短路之后）
3. JAVA_HOME/GOROOT 整块（现 441-464）移进 `if (ok) { ... }` 内
4. 收紧工具匹配（删除 `lowPath.find("jdk")` 子串判断）:
```cpp
    auto endsWith = [](const std::string& s, const char* suf){
        size_t n = strlen(suf); return s.size() >= n && s.compare(s.size()-n, n, suf) == 0;
    };
    bool isJava = (lowTool == "java" || lowTool == "jdk" || endsWith(lowPath, "java.exe"));
    bool isGo   = (lowTool == "go" || endsWith(lowPath, "go.exe") ||
                   lowPath.find("go\\bin") != std::string::npos);
```
**提交:** `git commit -m "fix(doctor): idempotent version switch, gate env writes on success, tighten tool match"`

---

### T17 (F15) 配置导出秘钥脱敏

**Files:** `recipe_manager.h`（public static）、`recipe_manager.cpp`（实现 + discoverCurrentConfigFiles 接入约 1036/1054）、`tests/test_v090.cpp`（Group 20）

**Step 1 - 失败测试:**

```cpp
    std::cout << "\n[Test Group 20: Config secret redaction]\n";
    {
        std::string npmrc = "//registry.npmjs.org/:_authToken=npm_SECRET123\n"
                            "registry=https://registry.npmjs.org/\n";
        std::string red = lazyenv::RecipeManager::redactConfigSecrets(npmrc);
        test("npm token redacted", red.find("npm_SECRET123") == std::string::npos);
        test("npm registry line kept",
             red.find("registry=https://registry.npmjs.org/") != std::string::npos);
        std::string gitcfg = "[credential]\n\thelper = store\n\tpassword = hunter2\n";
        std::string rg = lazyenv::RecipeManager::redactConfigSecrets(gitcfg);
        test("git password redacted", rg.find("hunter2") == std::string::npos);
    }
```

**Step 2 - 实现:**
```cpp
// recipe_manager.h (public)
    static std::string redactConfigSecrets(const std::string& content);
// recipe_manager.cpp
std::string RecipeManager::redactConfigSecrets(const std::string& content) {
    std::istringstream in(content);
    std::ostringstream out;
    std::string line;
    static const char* kSensitive[] = { "_authtoken", "_auth", "password", "passwd",
                                        "token", "secret" };
    auto lower = [](std::string s){
        for (auto& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        return s;
    };
    while (std::getline(in, line)) {
        std::string l = lower(line);
        bool hit = false;
        for (auto* k : kSensitive)
            if (l.find(k) != std::string::npos) { hit = true; break; }
        out << (hit ? "# [LazyEnv] redacted sensitive entry" : line) << "\n";
    }
    return out.str();
}
```
接入 discoverCurrentConfigFiles: `.gitconfig` 与 `.npmrc` 的 push 前 `content = redactConfigSecrets(content);`。
**已知取舍:** 逐行子串判断可能把个别含 "token" 字样的正常配置行也脱敏（宁多勿漏）。
**提交:** `git commit -m "fix(recipe): redact tokens/passwords when exporting config files"`

---
### T18 (F18) 修 test_cdp_v0814 两个错误断言

**Objective:** 两个失败均为**测试侧**问题（应用无 bug）：版本断言过期、分数断言逻辑错误。

**Files:** `tests/test_cdp_v0814.mjs`（2 处）

1) 文件顶部 import 区加:
```js
import { readFileSync } from 'node:fs';
const expectedVer = (readFileSync('D:\\Git\\LazyEnv\\CMakeLists.txt', 'utf8')
  .match(/project\(\s*LazyEnv\s+VERSION\s+(\d+\.\d+\.\d+)/) || [])[1];
```
版本断言（`test("UI shows LazyEnv v0.8.14", ...)`）替换为:
```js
    test("UI shows current project version",
         verRes?.result?.value?.includes(`v${expectedVer}`),
         `${verRes?.result?.value} (expected v${expectedVer})`);
```
2) scoresEqual 计算替换为:
```js
              var dn = parseInt(docScore, 10), hn = parseInt(homeScore, 10);
              resolve({
                docScore: docScore,
                homeScore: homeScore,
                homeSub: homeSub,
                scoresEqual: !isNaN(dn) && !isNaN(hn) && dn === hn
              })
```
对应 test 名与条件替换为:
```js
    test("Home page and PATH Doctor scores are identical", sData.scoresEqual,
         `Home: ${sData.homeScore}, Doctor: ${sData.docScore}`);
```

**Step - 验证:** `node tests\test_cdp_v0814.mjs` -> **13 passed, 0 failed**（本机 95==95 应转绿）。
**提交:** `git commit -m "test: fix stale version assertion and broken score comparison in v0.8.14 E2E"`

---

### T19 (F19) CI 接入测试

**Files:** `.github/workflows/ci.yml`（Build 与 Smoke check 之间插入）

```yaml
      - name: Unit tests
        shell: pwsh
        run: |
          ./build/Release/test_v0814.exe
          if ($LASTEXITCODE -ne 0) { throw "test_v0814 failed: $LASTEXITCODE" }
          ./build/Release/test_v090.exe
          if ($LASTEXITCODE -ne 0) { throw "test_v090 failed: $LASTEXITCODE" }

      - name: E2E tests (CDP)
        shell: pwsh
        run: |
          node --version
          node tests/test_cdp_v090.mjs
          if ($LASTEXITCODE -ne 0) { throw "cdp v090 failed" }
          node tests/test_cdp_v0814.mjs
          if ($LASTEXITCODE -ne 0) { throw "cdp v0814 failed" }
```

**验证:** 本地无 CI 环境；逐行核对 2 空格缩进与上下文顺序。push 后由用户观察首跑。
**回退预案:** 若 runner 上 E2E 因时序偶发失败，给 E2E 步骤加 `continue-on-error: true` 并在本计划状态栏记录，后续再收紧。
**提交:** `git commit -m "ci: run unit and CDP E2E tests on every push"`

---

### T20 (F20) 删死代码 + 修误导 toast

**Objective:** 删除 6 个无调用方的 C++ 处理器与 4 个永不触发的 JS case；修复 2 处失败 toast 文案错用（reorder/remove 失败却提示"提权重启失败"）。

**Files:** `main.cpp`、`resources/script.js`、`resources/i18n.js`

**删除前复核（每项必须 0 个调用方结果，否则停止该项并记录）:**
```powershell
Select-String -Path resources\*.js,resources\*.html -Pattern 'verifyCommand|getPinnedPackages|relaunchAsAdmin|"readEnv"|prioritizePath|checkCommand'
```

**C++ 删除清单（连同注释块一起删）:**
1. verifyCommand 分支（约 809-824，含 verifyStarted 返回）
2. checkCommand 分支（约 1952-1957）
3. getPinnedPackages 分支（约 1437-1447）
4. relaunchAsAdmin 分支（约 1349-1365）
5. readEnv 分支（约 2102-2108）
6. prioritizePath 分支（约 1244-1250）

**JS 删除清单（handleNative 的 case）:**
7. `case "verifyResult"`（约 431-437）
8. `case "prioritizePathResult"`（约 202 附近）
9. `case "wingetStatus"`（存在则删）
10. `case "relaunchFailed"`（约 276-278）

保留提醒: `removeFromPathResult`、`switchVersionResult`、`wingetStatus` 若被证明有真实发送方则保留（以复核 grep 结果为准）。i18n 键一律不删（`t("phase."+x)` 等动态拼接存在，静态分析不可靠；留着零成本）。

**Toast 修复（script.js 约 254 与 272）:**
- i18n.js en 区 `doctor.relaunchFailed` 旁新增:
  `"doctor.pathOpFailed": "PATH operation failed - check administrator permission and try again.",`
- zh 区对应新增:
  `"doctor.pathOpFailed": "PATH 操作失败，请检查管理员权限后重试。",`
- 两处调用改为 `t("doctor.pathOpFailed")`

**验证:** 构建 -> 全测 0 failed -> **2 个 CDP 全绿**（doctor 页交互被 v0814 E2E 覆盖）。
**提交:** `git commit -m "refactor(core): remove dead IPC handlers and fix misleading failure toasts"`

---
## Phase 4 - P3 健壮性收尾

### T21 (F21a) extractJsonValue 支持 \uXXXX

**Files:** `main.cpp` extractJsonValue（约 164-190）的 switch，加 'u' 分支:

```cpp
                case 'u': {
                    if (pos + 5 < json.size()) {
                        unsigned code = 0; bool okHex = true;
                        for (int k = 1; k <= 4; ++k) {
                            char c = json[pos + 1 + k]; unsigned v;
                            if (c >= '0' && c <= '9') v = c - '0';
                            else if (c >= 'a' && c <= 'f') v = c - 'a' + 10;
                            else if (c >= 'A' && c <= 'F') v = c - 'A' + 10;
                            else { okHex = false; break; }
                            code = (code << 4) | v;
                        }
                        if (okHex) {
                            if (code < 0x80) result += static_cast<char>(code);
                            else if (code < 0x800) {
                                result += static_cast<char>(0xC0 | (code >> 6));
                                result += static_cast<char>(0x80 | (code & 0x3F));
                            } else {
                                result += static_cast<char>(0xE0 | (code >> 12));
                                result += static_cast<char>(0x80 | ((code >> 6) & 0x3F));
                                result += static_cast<char>(0x80 | (code & 0x3F));
                            }
                            pos += 4;
                        } else result += 'u';
                    } else result += 'u';
                    break;
                }
```
**验证:** main.cpp 无法链入单测 -> 构建 + 全测 + 对照 rollback.cpp:85-130 已有实现做审查。
**提交:** `git commit -m "fix(core): decode \\uXXXX escapes in IPC JSON extraction"`

---

### T22 (F21b) main.cpp 数组解析改括号配对

**Objective:** 消灭 4 个 parseXxx 里 `rfind(']')`/`find('}')` 的脆弱定位（多数组消息靠运气解析对）。

**Files:** `main.cpp`（4 个 parseXxx: parseEnvironmentsFromJson 约 492、parseMissingPackagesFromJson 约 521、parseEnvVarsFromJson 约 549、parseUpgradeTargetsFromJson 约 576）

**Steps:**
1. 把 `rollback.cpp` 的 `findMatchingJsonArrayEnd` / `findMatchingJsonObjectEnd`（约 161-214，字符串/转义感知）复制到 main.cpp 匿名空间
2. 四个函数统一替换:
```cpp
    auto startArr = message.find('[', pos_after_key);
    if (startArr == std::string::npos) return ...;
    auto endArr = findMatchingJsonArrayEnd(message, startArr);   // 替代 rfind(']')
    ...
    auto objEnd = findMatchingJsonObjectEnd(message, oStart);    // 替代 find('}', oStart)
```
**验证:** 构建 + 全测 + **2 个 CDP 全绿**；重点回归 deployRecipe 的四数组消息（missingPackageIds/missingPackages/environmentVariables/paths）与 checkUpdates/environments 消息。
**提交:** `git commit -m "fix(core): use brace-aware JSON array parsing in IPC readers"`

---

### T23 (F21c) setPackagePinned 校验 id

**Files:** `update_manager.cpp` setPackagePinned（约 215-224；文件头补 `#include "installer.h"`）

```cpp
bool UpdateManager::setPackagePinned(const std::string& packageId, bool pinned) {
    if (packageId.empty()) return false;
    if (!Installer::isSafePackageId(packageId)) return false;  // 防含引号 id 污染 JSON 文件
    ...
}
```
**验证:** 构建 + 全测（依赖 T4a 的 isSafePackageId）。如构造 UpdateManager 副作用过大则以审查验证，如实标注。
**提交:** `git commit -m "fix(update): validate package ids before pin persistence"`

---

### T24 (F22) GetEnvironmentVariableW 上界检查

**Steps:**
1. `Select-String -Path *.cpp -Pattern 'GetEnvironmentVariableW'` 枚举全部站点
2. 已知要改: `package_manager.cpp` scoop 两处（约 225、246）；`main.cpp` 中 `> 0` 直接当成功用的站点（ProgramFiles/LOCALAPPDATA 等，约 397/426 附近；T20 删 relaunchAsAdmin 后该站点消失）
3. 统一改法:
```cpp
    wchar_t buf[MAX_PATH];
    DWORD n = GetEnvironmentVariableW(L"VARNAME", buf, MAX_PATH);
    if (n > 0 && n < MAX_PATH) { /* 使用 buf */ }
```
（`rollback.cpp:488/492` 已是正确写法，作参照不改。原因: 缓冲太小时函数返回"所需长度"且**不填充缓冲**，`> 0` 判断会把栈上垃圾当路径用。）
**验证:** 构建 + 全测；该 bug 需 >260 字符路径触发，无法单测 -> 审查验证，如实标注。
**提交:** `git commit -m "fix(core): validate environment variable buffer length results"`

---

### T25 (F23a-d) 四个小正确性修复（各自独立提交）

**T25a - `.condarc` 分类修正**
- `recipe_manager.cpp` discoverCurrentConfigFiles 中 condarc 的 `"pip"` 改 `"conda"`（约 1106 行）
- 先 `Select-String -Path resources\style.css -Pattern 'config-item-chip__cat--'`：若无 `--conda` 规则，复制 `--pip` 规则一条改名（否则 chip 无样式）
- 提交 `fix(recipe): categorize condarc as conda`

**T25b - upgradeBatch 异常兜底总数**
- `main.cpp` upgradeBatch 的 catch（约 802）: `failCount:1,total:1` 改为按 `targets.size()`（successCount:0，failCount=total=targets.size()；0 目标时全 0）
- 提交 `fix(update): report real target count in batch failure fallback`

**T25c - diagnoseFailure 匹配收紧**
- `update_manager.cpp`（约 94）: `output.find("running")` -> `output.find("is running") || output.find("currently running") || output.find("close the app")`
- `exitCode == 1 -> FILE_LOCKED` 保留（有意启发式），确认它位于本分支的各精确匹配之后
- 提交 `fix(update): tighten process-locked diagnostic matching`

**T25d - diagnose 死路径不参与去重集合**
- `path_doctor.cpp`（约 145-147）改为:
```cpp
            if (diag.exists) {
                diag.isDuplicate =
                    seenNormalizedPaths.find(norm) != seenNormalizedPaths.end();
                seenNormalizedPaths.insert(norm);
            } else {
                diag.isDuplicate = false;   // 死路径不遮蔽后续有效路径
            }
```
- 提交 `fix(doctor): exclude dead paths from duplicate tracking`
- 验证: 构建 + CDP v0814（doctor 分数/过滤器交互）全绿

---

### T26 (F23c) 命令超时杀进程树

**Objective:** 超时时终止 cmd 及子孙（winget 等），防孤儿进程继续安装；正常结束不杀树（安装器可能有意 spawn 存活进程）。

**Files:** `installer.cpp` launchProcess（约 651-694）、runCommand（约 701-768）、runCommandStreaming（约 773-865）

**实现要点:**
```cpp
bool launchProcess(const std::string& cmdLine, HANDLE hWritePipe,
                   PROCESS_INFORMATION& pi, HANDLE& hJob) {
    hJob = CreateJobObjectW(nullptr, nullptr);   // 不设 KILL_ON_JOB_CLOSE：正常结束不杀树
    ... 原 CreateProcessW ...
    if (ok && hJob) {
        if (!AssignProcessToJobObject(hJob, pi.hProcess)) {
            CloseHandle(hJob); hJob = nullptr;   // 嵌套 job 受限时优雅降级
        }
    }
    return ok != FALSE;
}
```
runCommand / runCommandStreaming 两处:
```cpp
    HANDLE hJob = nullptr;
    ... launchProcess(cmdLine, ph.hWrite, pi, hJob) ...
    // 超时分支:
    if (elapsed >= timeoutMs) {
        if (hJob) TerminateJobObject(hJob, static_cast<UINT>(-1));  // 杀整棵进程树
        else TerminateProcess(pi.hProcess, static_cast<UINT>(-1));
        break;
    }
    // 收尾（超时与否都执行）:
    if (hJob) CloseHandle(hJob);
```
**验证:** 构建 + 全测；手动: 临时用 1000ms 超时跑 `ping -t 127.0.0.1`，任务管理器确认无残留 ping（验证后还原）。无法自动化部分如实标注。
**提交:** `git commit -m "fix(installer): terminate child process tree on command timeout"`

---
## Phase 5 - 最终验收

### T27 全量回归与交付

**Steps:**
1. 构建: `& $CMAKE --build build --config Release --parallel` -> exit 0
2. `test_v0814.exe` -> 0 failed
3. `test_v090.exe` -> 0 failed（含新增 Group 11-20）
4. `node tests\test_cdp_v090.mjs` -> 全绿
5. `node tests\test_cdp_v0814.mjs` -> 13/13
6. `node tests\test_cdp_path_smoke.mjs` -> PASS（T11 新增）
7. `git log --oneline 2f1b5cc..HEAD` -> 每任务一个提交，无遗漏
8. `git diff 2f1b5cc --stat` -> 改动面未超出计划文件清单
9. 静态复扫:
```powershell
Select-String -Path *.cpp -Pattern 'std::thread\('        # 逐处确认有防护（自带 try 或 spawnGuarded）
Select-String -Path *.cpp -Pattern 'install --id|upgrade --id|config set registry'  # 确认注入点上游有校验
Select-String -Path main.cpp -Pattern 'if \(action =='    # 数量应比基线少 6（删死处理器）
```
10. 更新本计划 §1 状态栏全部 [x]；写明任何"未复现/降级处理"项；向用户交付报告（做了什么/依据什么/验证了什么/结果如何/未完成/风险）

---


## 1.1 事故记录 F24（执行期间发生，已处置）

- **现象**: 2026-11-04 18:18-18:23 间，HKCU\Environment 被整组破坏（36 用户变量丢失，Path 被清空/替换），CDP doctor 从 50 行跌到 20 行。
- **取证**: 215 个历史快照做时间线 diff；确定损坏窗口 = T3-failfirst 运行的 G11-G15；当前代码重复运行**不复现**（疑似一次性竞态）。
- **处置**: ①从会话前纯净快照 a141843a 用真 JSON 解析器全量恢复 36/36（最终审计: 0 缺失/0 差异/0 控制字符/0 多余，raw Path=1223/30条）；②恢复脚本 v1 曾因手写反转义（大小写不敏感 `\t`→TAB）二次破坏 Path/TEMP/TMP，已用 ConvertFrom-Json 重写修复；③备份留存: `%LOCALAPPDATA%\LazyEnv\HKCU_env_backup_before_recovery.json`。
- **产品加固（已提交 ebe7ce0）**: createSnapshot 拒绝空 user_env；restore 拒绝"快照无 Path 而当前有 Path"；PathDoctor 5 处"绝不写空 PATH"（addPath/removePath/reorder/switch/autoClean）。
- **测试加固**: G12 DWORD 清理改 KEY_SET_VALUE（原 KEY_READ 静默失败=残留根因）；新增 G16 全套件 HKCU 值数守恒断言。
- **注意**: PowerShell `Get-ItemProperty` 对 REG_EXPAND_SZ 默认展开——校验原始值必须用 `RegistryKey.GetValue(..., DoNotExpandEnvironmentNames)`。


## 1.2 完成记录（T27 验收，2026-11-04）

- **最终验证**: build exit 0；test_v0814 26/0；test_v090 **68/0**（基线 37 + 新增 Group 11-22 共 31 条）；test_cdp_v090 15/0；test_cdp_v0814 **13/0**（基线 11/2，两个过期断言已修）；test_cdp_path_smoke PASS（T11 新增）。
- **CI 首跑结果（T19 后续, run 41839427238 @ e3d5d96, 全绿）**: 经 8 轮迭代修复 3 个 CI 专属问题：
  ① WebView2 loader 在 runner 上丢弃 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` → 应用改为经 `ICoreWebView2EnvironmentOptions` 显式传参（产品修复, webview_host.cpp）；
  ② v0814 官方文档断言机器相关（要求本机存在 java 冲突）→ 改为条件断言 + 文档按钮 `data-eco` 探测器；
  ③ smoke 异形目录含 CJK 时 node v22 在 Windows 的 fs.cp 静默不建目录 → 改纯 ASCII 目录（保留空格/%/# 三个 URI 关键字符）。
- **提交**: 34 个提交（`9fc074e`..`f847758`），每任务一个，父链自 `2f1b5cc`。
- **改动面**: 21 文件 +2477/-265，与计划清单一致，无范围蔓延（`git diff 2f1b5cc --stat` 核对）。
- **静态复扫**: 15 处 `std::thread` 全部带防护；11 个 shell 命令构造点全部有上游校验；`if (action ==` 49→43（-6，死处理器删除数精确匹配）。
- **偏离与降级记录**:
  1. F24 环境清空事故的原始触发竞争**未能稳定复现**（当前代码重复运行不触发）——按计划降级为"防御加固（ebe7ce0）+ 全套件值数守恒断言（G16）+ 恢复"，未找到唯一根因函数，风险由新守恒断言持续监控。
  2. test_cdp_v090 观察到 2 次固定 sleep 时序抖动（重跑即绿）——CI 若复现按计划回退预案给 E2E 步骤加 `continue-on-error: true`。
  3. T19 的 CI 效果需推送后在 Actions 观察首跑（本机已验证全部测试步骤可独立通过）。
  4. 执行中新增范围：F24 相关修复与 G16 断言为计划外但事故处置必需；T4b 顺带补齐 scoop/npm/pip provider 三处同类缺口（超出 8 点清单，属 F4 同一目标）。
  5. 测试辅助期间修复的测试自身缺陷：G5 改用白名单宏（T3 连带）、G12 DWORD 清理 KEY_SET_VALUE、G11 文件锁关闭——均已随对应任务提交。

## 2. 明确不修清单（防范围蔓延）

| 项 | 决定 | 理由 |
|---|---|---|
| >2MB 配置文件静默跳过（recipe_manager.cpp readFileUtf8） | 不改，文档化为已知限制 | 改成提示需动 IPC 协议，属功能新增 |
| detectInstalledEnvironments 串行 60 条命令慢 | 不改 | 性能优化是独立特性；当前在后台线程不冻结 UI |
| i18n 约 215 个"静态未用"键 | 不删 | `t("phase."+x)` 等动态拼接，静态分析会误判；删除零收益有风险 |
| diagnoseFailure exitCode==1 -> FILE_LOCKED 启发式 | 保留 | 有注释的有意取舍，仅收紧英文子串 |
| 注册表 DWORD 的快照序列化（永久保留能力） | 不做 | Environment 键语义上只应有字符串值；非字符串"不碰"即可 |
| probeCommand 的 flag 拼接逻辑（探测语义） | 保留 | 功能本意就是执行用户命令；只加字符白名单（T4b） |

## 3. 风险与降级预案

1. **T2 restore 语义变更**: 快照里没有、现在存在的字符串变量不会被删（旧语义完全回到快照）。刻意取舍——环境键内字符串变量都属本工具管辖；若回归不妥回退该单个提交。
2. **T1/T2 改 registry 写路径**: 测试自带变量清理与 PATH 还原；若测试中断，手动复位: 删除 `HKCU\Environment\LazyEnvTest*`、快照目录内 `*test*`/`f2-empty*` 文件、temp 下 `lazyenv_*_test*`。
3. **T26 Job Object**: 受限环境可能拒绝嵌套 job -> 已设计降级（Assign 失败回退 TerminateProcess）。
4. **T19 CI E2E 时序**: 见回退预案（continue-on-error）。
5. **T10 单实例**: 依赖 FindWindowW(kWindowClass) 能找到既有窗口；若既有窗口在别的桌面会话则只退出（可接受）。
6. **行号漂移**: 所有任务给出上下文锚点，修改后不依赖行号。
7. **任务间依赖**: T4b 依赖 T4a；T9 依赖 T6；T23 依赖 T4a。其余任务可独立回退。

## 4. 基线记录（T0.2 执行时填写）

| 项 | 基线结果 | 备注 |
|---|---|---|
| build | exit 0（无警告） | 2026-11-04 T0.2 复跑确认 |
| test_v0814 | 26 passed / 0 failed | 2026-11-04 已预跑确认 |
| test_v090 | 37 passed / 0 failed | 2026-11-04 已预跑确认 |
| test_cdp_v090 | 15 passed / 0 failed | 2026-11-04 已预跑确认 |
| test_cdp_v0814 | 11 passed / 2 failed | 版本断言过期 + 分数断言逻辑错误（T18 修复目标） |
| HEAD | 2f1b5cc | working tree clean |
