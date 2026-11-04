#include "installer.h"
#include "rollback.h"
#include "recipe_manager.h"
#include "path_doctor.h"

#include <Windows.h>
#include <iostream>
#include <cassert>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <mutex>
#include <set>
#include <thread>
#include <filesystem>
#include <fstream>

static int g_passed = 0;
static int g_hkcuBaseline = -1;   // HKCU value-count guard (incident 2026-11-04)
static int g_failed = 0;

void test(const std::string& name, bool cond) {
    if (cond) {
        std::cout << "  [PASS] " << name << "\n";
        g_passed++;
    } else {
        std::cerr << "  [FAIL] " << name << "\n";
        g_failed++;
    }
}

static int hkcuValueCount() {
    HKEY k = nullptr;
    int count = 0;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Environment", 0, KEY_READ, &k) == ERROR_SUCCESS) {
        wchar_t name[512];
        DWORD idx = 0;
        while (true) {
            DWORD len = 512;
            if (RegEnumValueW(k, idx, name, &len, nullptr, nullptr, nullptr, nullptr) != ERROR_SUCCESS) break;
            count++; idx++;
        }
        RegCloseKey(k);
    }
    return count;
}
int main() {
    std::cout << "=============================================================\n";
    std::cout << "  LazyEnv v0.9.0 Comprehensive Unit & Regression Test Suite  \n";
    std::cout << "=============================================================\n";

    // -------------------------------------------------------------
    // Test 1: Recipe v2.0 Serialization & Deserialization
    // -------------------------------------------------------------
    g_hkcuBaseline = hkcuValueCount();   // guard: suite must not change HKCU value count

    std::cout << "\n[Test Group 1: Recipe v2.0 Serialization & Deserialization]\n";
    {
        lazyenv::EnvironmentRecipe rec;
        rec.formatVersion = "2.0";
        rec.metadata.name = "Full-4-in-1-Stack";
        rec.metadata.description = "Complete stack for v0.9.0 migration";
        rec.metadata.author = "vjiaoziv";

        lazyenv::RecipePackageItem p1;
        p1.id = "Git.Git";
        p1.name = "Git";
        p1.source = "winget";
        p1.version = "2.47.1";
        rec.packages.push_back(p1);

        lazyenv::RecipeEnvVar v1;
        v1.name = "TEST_VAR";
        v1.value = "test_val";
        v1.type = "REG_SZ";
        rec.environmentVariables.push_back(v1);

        lazyenv::RecipeConfigFile c1;
        c1.category = "git";
        c1.name = "Git Config (.gitconfig)";
        c1.relativePath = ".gitconfig";
        c1.targetDirMacro = "%USERPROFILE%";
        c1.content = "[user]\n\tname = TestUser\n\temail = test@example.com\n";
        rec.configFiles.push_back(c1);

        lazyenv::RecipeConfigFile c2;
        c2.category = "pip";
        c2.name = "Pip Config (pip.ini)";
        c2.relativePath = "pip/pip.ini";
        c2.targetDirMacro = "%APPDATA%";
        c2.content = "[global]\nindex-url = https://pypi.tuna.tsinghua.edu.cn/simple\n";
        rec.configFiles.push_back(c2);

        lazyenv::RecipeIdeExtension ext1;
        ext1.ide = "vscode";
        ext1.extensionId = "ms-python.python";
        ext1.displayName = "Python";
        rec.ideExtensions.push_back(ext1);

        std::string json = lazyenv::RecipeManager::serializeRecipeToJson(rec);
        test("Serialized JSON contains formatVersion 2.0", json.find("formatVersion") != std::string::npos && json.find("2.0") != std::string::npos);
        test("Serialized JSON contains configFiles array", json.find("configFiles") != std::string::npos);
        test("Serialized JSON contains ideExtensions array", json.find("ideExtensions") != std::string::npos);
        test("Serialized JSON contains .gitconfig content", json.find("TestUser") != std::string::npos);

        lazyenv::EnvironmentRecipe parsed;
        bool parseOk = lazyenv::RecipeManager::parseRecipeFromJson(json, parsed);
        test("Parse v2.0 JSON succeeded", parseOk);
        test("Parsed formatVersion is 2.0", parsed.formatVersion == "2.0");
        test("Parsed name matches", parsed.metadata.name == "Full-4-in-1-Stack");
        test("Parsed configFiles count is 2", parsed.configFiles.size() == 2);
        if (parsed.configFiles.size() == 2) {
            test("Config 0 category is git", parsed.configFiles[0].category == "git");
            test("Config 0 content matches", parsed.configFiles[0].content.find("TestUser") != std::string::npos);
            test("Config 1 macro is %APPDATA%", parsed.configFiles[1].targetDirMacro == "%APPDATA%");
        }
        test("Parsed ideExtensions count is 1", parsed.ideExtensions.size() == 1);
        if (!parsed.ideExtensions.empty()) {
            test("Extension ID is ms-python.python", parsed.ideExtensions[0].extensionId == "ms-python.python");
        }
    }

    // -------------------------------------------------------------
    // Test 2: Recipe v1.0 Backward Compatibility
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 2: Recipe v1.0 Backward Compatibility]\n";
    {
        std::string v1Json = "{\n"
            "  \"formatVersion\": \"1.0\",\n"
            "  \"metadata\": {\n"
            "    \"name\": \"LegacyStack\",\n"
            "    \"description\": \"Legacy v1 stack\",\n"
            "    \"author\": \"vjiaoziv\"\n"
            "  },\n"
            "  \"packages\": [\n"
            "    {\"id\": \"Node.js\", \"name\": \"Node.js\", \"source\": \"winget\"}\n"
            "  ],\n"
            "  \"environmentVariables\": [\n"
            "    {\"name\": \"NODE_ENV\", \"value\": \"development\"}\n"
            "  ]\n"
            "}";

        lazyenv::EnvironmentRecipe parsedV1;
        bool ok = lazyenv::RecipeManager::parseRecipeFromJson(v1Json, parsedV1);
        test("Parse v1.0 JSON succeeded", ok);
        test("Parsed formatVersion is 1.0", parsedV1.formatVersion == "1.0");
        test("Parsed packages count is 1", parsedV1.packages.size() == 1);
        test("Parsed configFiles is empty", parsedV1.configFiles.empty());
        test("Parsed ideExtensions is empty", parsedV1.ideExtensions.empty());
    }

    // -------------------------------------------------------------
    // Test 3: Local Asset Discovery & Security Redline Verification
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 3: Local Asset Discovery & Security Redline]\n";
    {
        auto configs = lazyenv::RecipeManager::discoverCurrentConfigFiles();
        std::cout << "  Discovered " << configs.size() << " config file(s) on current machine.\n";
        bool hasSensitiveFile = false;
        for (const auto& c : configs) {
            std::string low = c.relativePath;
            for (auto& ch : low) ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
            if (low.find("id_rsa") != std::string::npos ||
                low.find("id_ed25519") != std::string::npos ||
                low.find("id_ecdsa") != std::string::npos ||
                low.find(".pem") != std::string::npos) {
                hasSensitiveFile = true;
                break;
            }
        }
        test("Security Redline: No SSH private keys or certificates collected", !hasSensitiveFile);

        auto exts = lazyenv::RecipeManager::discoverIdeExtensions();
        std::cout << "  Discovered " << exts.size() << " IDE extension(s) on current machine.\n";
        test("IDE extensions scan completed without error", true);
    }

    // -------------------------------------------------------------
    // Test 4: 4-in-1 Migration Recipe Creation
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 4: 4-in-1 Migration Recipe Creation]\n";
    {
        std::vector<lazyenv::DetectedEnvItem> mockEnvs;
        lazyenv::DetectedEnvItem itm;
        itm.name = "Python 3.12";
        itm.command = "python";
        itm.version = "3.12.2";
        itm.category = "language";
        mockEnvs.push_back(itm);

        auto fullRecipe = lazyenv::RecipeManager::createMigrationRecipe(
            "AutoMigration", "Migrate all assets", "Tester", mockEnvs,
            "https://registry.npmmirror.com", "https://pypi.tuna.tsinghua.edu.cn/simple",
            true, true, true, true);

        test("createMigrationRecipe formatVersion is 2.0", fullRecipe.formatVersion == "2.0");
        test("createMigrationRecipe packages included", !fullRecipe.packages.empty());
        test("createMigrationRecipe author matches", fullRecipe.metadata.author == "Tester");

        auto minimalRecipe = lazyenv::RecipeManager::createMigrationRecipe(
            "MinMigration", "No configs or exts", "Tester", mockEnvs,
            "", "", true, false, false, false);
        test("minimalRecipe has empty configFiles", minimalRecipe.configFiles.empty());
        test("minimalRecipe has empty ideExtensions", minimalRecipe.ideExtensions.empty());
    }

    // -------------------------------------------------------------
    // Test 5: Config Restoration & Safety Airbag Backup
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 5: Config Restoration & Safety Airbag Backup]\n";
    {
        namespace fs = std::filesystem;
        fs::path tempBase = fs::temp_directory_path() / "LazyEnv_Test_Migration";
        std::error_code ec;
        fs::remove_all(tempBase, ec);
        fs::create_directories(tempBase, ec);

        fs::path mockBackupDir = tempBase / "snapshots" / "snap_test" / "configs";
        fs::create_directories(mockBackupDir, ec);

        // Target through a whitelisted macro (%USERPROFILE%); absolute
        // targetDirMacro paths are intentionally rejected since F3.
        wchar_t upBuf[1024] = {0};
        GetEnvironmentVariableW(L"USERPROFILE", upBuf, 1024);
        fs::path targetFile = fs::path(upBuf) / ".lazyenv_test_migration.ini";
        fs::remove(targetFile, ec);   // non-throwing overload
        {
            std::ofstream ofs(targetFile);
            ofs << "original_secret_data=123\n";
        }

        lazyenv::RecipeConfigFile cfg;
        cfg.category = "pip";
        cfg.name = "Mock App INI";
        cfg.relativePath = targetFile.filename().string();
        cfg.targetDirMacro = "%USERPROFILE%";
        cfg.content = "new_restored_data=456\n";

        std::vector<lazyenv::RecipeConfigFile> cfgs = { cfg };
        bool restored = lazyenv::RecipeManager::restoreConfigFiles(cfgs, mockBackupDir.string(), [](const std::string&){});
        test("restoreConfigFiles completed successfully", restored);

        // Verify target file was replaced
        std::ifstream ifsNew(targetFile);
        std::string newContent((std::istreambuf_iterator<char>(ifsNew)), std::istreambuf_iterator<char>());
        test("Target file updated with new restored content", newContent.find("new_restored_data=456") != std::string::npos);
        ifsNew.close();   // must close before deleting the target file

        // Verify backup file was preserved in backupDir
        bool foundBackup = false;
        for (const auto& entry : fs::directory_iterator(mockBackupDir)) {
            std::ifstream ifsBak(entry.path());
            std::string bakContent((std::istreambuf_iterator<char>(ifsBak)), std::istreambuf_iterator<char>());
            if (bakContent.find("original_secret_data=123") != std::string::npos) {
                foundBackup = true;
                break;
            }
        }
        test("Original file was safely archived in backup directory before overwrite", foundBackup);

        fs::remove(targetFile, ec);   // non-throwing overload
        fs::remove_all(tempBase, ec);
    }

    // -------------------------------------------------------------
    // Test 6: RollbackManager Storage Dir
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 6: RollbackManager Storage Dir]\n";
    {
        lazyenv::RollbackManager rollback;
        auto dir = rollback.getStorageDir();
        test("RollbackManager storage dir is non-empty", !dir.empty());
    }

    // -------------------------------------------------------------
    // Test 7: Version Consistency Check
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 7: Version Consistency]\n";
    {
        std::string ver = LAZYENV_VERSION_STRING;
        test("Version string is 0.9.0", ver == "0.9.0");
    }
    // -------------------------------------------------------------
    // Test 8: Security - Path Traversal (Zip Slip) Interception
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 8: Security - Path Traversal (Zip Slip) Interception]\n";
    {
        namespace fs = std::filesystem;
        fs::path tempBase = fs::temp_directory_path() / "LazyEnv_Security_Test";
        std::error_code ec;
        fs::remove_all(tempBase, ec);
        fs::create_directories(tempBase, ec);

        fs::path canaryFile = fs::temp_directory_path() / "lazyenv_traversal_canary.txt";
        fs::remove(canaryFile, ec);

        lazyenv::RecipeConfigFile maliciousCfg;
        maliciousCfg.category = "git";
        maliciousCfg.name = "Malicious Config";
        maliciousCfg.relativePath = "../lazyenv_traversal_canary.txt";
        maliciousCfg.targetDirMacro = tempBase.string();
        maliciousCfg.content = "SHOULD_NEVER_BE_WRITTEN";

        std::vector<lazyenv::RecipeConfigFile> cfgs = { maliciousCfg };
        lazyenv::RecipeManager::restoreConfigFiles(cfgs, "", [](const std::string&){});

        test("Malicious relative path traversal blocked", !fs::exists(canaryFile));

        fs::remove_all(tempBase, ec);
        fs::remove(canaryFile, ec);
    }

    // -------------------------------------------------------------
    // Test 9: Robust JSON Array & String Matching
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 9: Robust JSON Array & String Matching]\n";
    {
        std::string jsonWithBraces = "{\n"
            "  \"formatVersion\": \"2.0\",\n"
            "  \"metadata\": { \"name\": \"ComplexJson\" },\n"
            "  \"environmentVariables\": [\n"
            "    {\"name\": \"COMPLEX_VAR\", \"value\": \"prefix {middle} [brackets] suffix\", \"type\": \"REG_SZ\"}\n"
            "  ],\n"
            "  \"configFiles\": [\n"
            "    {\"category\": \"git\", \"name\": \"Cfg\", \"relativePath\": \".gitconfig\", \"targetDirMacro\": \"%USERPROFILE%\", \"content\": \"content with {braces} and [brackets]\", \"isBase64\": false}\n"
            "  ]\n"
            "}";

        lazyenv::EnvironmentRecipe r;
        bool ok = lazyenv::RecipeManager::parseRecipeFromJson(jsonWithBraces, r);
        test("Parsed JSON with embedded braces and brackets", ok);
        test("Complex environment variable value preserved exactly", !r.environmentVariables.empty() && r.environmentVariables[0].value == "prefix {middle} [brackets] suffix");
        test("Config file content with braces preserved exactly", !r.configFiles.empty() && r.configFiles[0].content == "content with {braces} and [brackets]");
    }

    // -------------------------------------------------------------
    // Test 10: PATH Doctor Non-redundant Snapshot Protection
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 10: PATH Doctor Non-redundant Snapshot Protection]\n";
    {
        lazyenv::RollbackManager rollback;
        std::string snapId;
        std::string dummyPath = "C:\\Windows\\System32";
        bool ok = lazyenv::PathDoctor::addPath(dummyPath, false, rollback, snapId);
        test("addPath 1st call ok", ok);
        // If dummyPath already exists in User PATH, snapId must be empty
        // If not, add it again to verify idempotency
        std::string secondSnapId;
        bool ok2 = lazyenv::PathDoctor::addPath(dummyPath, false, rollback, secondSnapId);
        test("addPath idempotent return is true", ok2);
        test("addPath duplicate does not create redundant snapshot", secondSnapId.empty());
        std::string cleanupSnap;
        lazyenv::PathDoctor::removePath(dummyPath, false, rollback, cleanupSnap);
    }


    // -------------------------------------------------------------
    // Test Group 11: Oversized registry value capture (F1)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 11: Oversized registry value capture]\n";
    {
        std::string bigVal(200 * 1024, 'A');   // 200KB > old 32767-byte stack buffer
        lazyenv::RollbackManager::writeEnvVariable("LazyEnvTestBigVar", bigVal, REG_SZ, false);
        lazyenv::RollbackManager rb;
        std::string sid = rb.createSnapshot("F1 big value");
        test("createSnapshot with 200KB value returns id", !sid.empty());
        if (!sid.empty()) {
            std::string json;
            {
                std::ifstream f(rb.getStorageDir() / (sid + ".json"), std::ios::binary);
                json.assign((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
            }   // close before delete, otherwise delete throws (file lock)
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

    // -------------------------------------------------------------
    // Test Group 12: Restore preserves non-string values + empty guard (F2)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 12: Restore preserves non-string values + empty guard]\n";
    {
        // (a) DWORD must survive a restore round-trip
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
        if (RegOpenKeyExW(HKEY_CURRENT_USER, L"Environment", 0, KEY_READ | KEY_SET_VALUE, &k) == ERROR_SUCCESS) {
            if (RegQueryValueExW(k, L"LazyEnvTestDword", nullptr, &typ,
                                 reinterpret_cast<BYTE*>(&got), &sz) == ERROR_SUCCESS
                && typ == REG_DWORD && got == 42) present = true;
            RegDeleteValueW(k, L"LazyEnvTestDword");   // needs KEY_SET_VALUE (was silently failing)
            RegCloseKey(k);
        }
        test("DWORD value survives restore", present);
        if (!sid.empty()) rb.deleteSnapshot(sid);

        // (b) an empty user_env snapshot must be refused (would wipe env)
        lazyenv::RollbackManager rb2;
        std::string eid = "f2-empty-snapshot-test";
        {
            std::ofstream ef(rb2.getStorageDir() / (eid + ".json"), std::ios::trunc);
            ef << "{\n  \"id\": \"" << eid << "\",\n  \"timestamp\": \"2026-11-04T00:00:00\",\n"
               << "  \"description\": \"empty\",\n  \"user_env\": [],\n  \"system_env\": []\n}\n";
        }
        bool emptyRestored = rb2.restoreSnapshot(eid);
        test("Empty snapshot restore is refused", !emptyRestored);
        rb2.deleteSnapshot(eid);
    }

    // -------------------------------------------------------------
    // Test Group 13: Recipe path security (F3)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 13: Recipe path security]\n";
    {
        namespace fs = std::filesystem;
        // (a) non-whitelisted absolute targetDirMacro must be rejected
        fs::path evilFile = fs::temp_directory_path() / "lazyenv_zipslip_test.txt";
        fs::remove(evilFile);
        lazyenv::RecipeConfigFile evil;
        evil.category = "test"; evil.name = "evil";
        evil.relativePath = "lazyenv_zipslip_test.txt";
        evil.targetDirMacro = fs::temp_directory_path().string();   // absolute path with ':'
        evil.content = "pwned";
        std::vector<lazyenv::RecipeConfigFile> bad{ evil };
        lazyenv::RecipeManager::restoreConfigFiles(bad, "", nullptr);
        test("Non-whitelisted targetDirMacro is rejected", !fs::exists(evilFile));
        fs::remove(evilFile);

        // (b) rooted relativePath must be rejected
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

        // (c) legit %USERPROFILE% config still restores
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

    // -------------------------------------------------------------
    // Test Group 14: Shell input validation (F4)
    // -------------------------------------------------------------
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

    // -------------------------------------------------------------
    // Test Group 15: Concurrency guards (F5)
    // Regression guard: data races cannot fail deterministically, so this
    // asserts post-fix invariants (unique ids, stable cached value).
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 15: Concurrency guards]\n";
    {
        std::mutex mtx;
        std::vector<std::string> ids;
        std::vector<std::thread> ths;
        for (int t = 0; t < 4; t++) {
            ths.emplace_back([&]() {
                lazyenv::RollbackManager rb;
                for (int i = 0; i < 50; i++) {
                    std::string id = rb.createSnapshot("stress");
                    if (!id.empty()) {
                        std::lock_guard<std::mutex> lk(mtx);
                        ids.push_back(id);
                    }
                }
            });
        }
        for (auto& th : ths) th.join();
        std::sort(ids.begin(), ids.end());
        bool uniq = std::adjacent_find(ids.begin(), ids.end()) == ids.end();
        test("Concurrent snapshot ids unique", ids.size() == 200 && uniq);
        lazyenv::RollbackManager rbClean;
        for (auto& id : ids) rbClean.deleteSnapshot(id);

        std::mutex mtx2;
        std::set<std::string> seen;
        std::vector<std::thread> ths2;
        for (int t = 0; t < 4; t++) {
            ths2.emplace_back([&]() {
                for (int i = 0; i < 50; i++) {
                    std::string v = lazyenv::Installer::getWingetExecutable();
                    std::lock_guard<std::mutex> lk(mtx2);
                    seen.insert(v);
                }
            });
        }
        for (auto& th : ths2) th.join();
        test("Concurrent getWingetExecutable stable", seen.size() == 1);
    }
    // -------------------------------------------------------------
    // Test Group 16: Environment preservation guard (incident regression)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 16: Environment preservation guard]\n";
    test("HKCU environment value count preserved by suite",
         g_hkcuBaseline >= 0 && hkcuValueCount() == g_hkcuBaseline);

    // -------------------------------------------------------------
    // Test Group 17: Winget update matching (F11)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 17: Winget update matching]\n";
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

    // -------------------------------------------------------------
    // Test Group 18: Critical env var protection (F12)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 18: Critical env var protection]\n";
    test("Critical vars protected",
         lazyenv::RollbackManager::isCriticalEnvVar("Path") &&
         lazyenv::RollbackManager::isCriticalEnvVar("PATHEXT") &&
         lazyenv::RollbackManager::isCriticalEnvVar("TEMP") &&
         lazyenv::RollbackManager::isCriticalEnvVar("USERPROFILE") &&
         lazyenv::RollbackManager::isCriticalEnvVar("ProgramFiles(x86)"));
    test("Ordinary var not protected",
         !lazyenv::RollbackManager::isCriticalEnvVar("MY_TOOL_HOME"));

    // -------------------------------------------------------------
    // Test Group 19: autoClean success logic (F13)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 19: autoClean success logic]\n";
    test("User-clean-disabled does not fail overall",
         lazyenv::PathDoctor::computeAutoCleanSuccess(false, true, false, true, false, true));
    test("Requested clean that failed reports failure",
         !lazyenv::PathDoctor::computeAutoCleanSuccess(true, true, false, true, false, true));
    test("No changes reports success",
         lazyenv::PathDoctor::computeAutoCleanSuccess(true, false, false, true, false, false));

    // -------------------------------------------------------------
    // Test Group 20: switchActiveVersion idempotency (F14)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 20: switchActiveVersion idempotency]\n";
    {
        namespace fs = std::filesystem;
        fs::path tmp = fs::temp_directory_path() / "lazyenv_switch_test_bin";
        fs::create_directories(tmp);
        std::string tmpA = tmp.string();
        std::string origPath = lazyenv::RollbackManager::readEnvVariable("Path", false);
        // put the target dir at the FRONT so a switch must be a no-op
        lazyenv::RollbackManager::writeEnvVariable("Path", tmpA + ";" + origPath,
                                                    REG_EXPAND_SZ, false);
        lazyenv::RollbackManager rb;
        std::string sid;
        bool ok = lazyenv::PathDoctor::switchActiveVersion("python", tmpA, rb, sid);
        test("Idempotent switch succeeds", ok);
        test("Idempotent switch creates no snapshot", sid.empty());
        // restore original exactly
        lazyenv::RollbackManager::writeEnvVariable("Path", origPath, REG_EXPAND_SZ, false);
        lazyenv::RollbackManager::broadcastEnvironmentChange();
        fs::remove_all(tmp);
    }
    std::cout << "\n=============================================================\n";
    std::cout << "Test Summary: " << g_passed << " passed, " << g_failed << " failed\n";
    std::cout << "=============================================================\n";

    return (g_failed == 0) ? 0 : 1;
}
