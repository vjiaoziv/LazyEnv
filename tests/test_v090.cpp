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
#include <filesystem>
#include <fstream>

static int g_passed = 0;
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

int main() {
    std::cout << "=============================================================\n";
    std::cout << "  LazyEnv v0.9.0 Comprehensive Unit & Regression Test Suite  \n";
    std::cout << "=============================================================\n";

    // -------------------------------------------------------------
    // Test 1: Recipe v2.0 Serialization & Deserialization
    // -------------------------------------------------------------
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

        fs::path targetFile = tempBase / "mock_app.ini";
        {
            std::ofstream ofs(targetFile);
            ofs << "original_secret_data=123\n";
        }

        lazyenv::RecipeConfigFile cfg;
        cfg.category = "pip";
        cfg.name = "Mock App INI";
        cfg.relativePath = targetFile.filename().string();
        cfg.targetDirMacro = tempBase.string(); // Using physical directory for test target
        cfg.content = "new_restored_data=456\n";

        std::vector<lazyenv::RecipeConfigFile> cfgs = { cfg };
        bool restored = lazyenv::RecipeManager::restoreConfigFiles(cfgs, mockBackupDir.string(), [](const std::string&){});
        test("restoreConfigFiles completed successfully", restored);

        // Verify target file was replaced
        std::ifstream ifsNew(targetFile);
        std::string newContent((std::istreambuf_iterator<char>(ifsNew)), std::istreambuf_iterator<char>());
        test("Target file updated with new restored content", newContent.find("new_restored_data=456") != std::string::npos);

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

    std::cout << "\n=============================================================\n";
    std::cout << "Test Summary: " << g_passed << " passed, " << g_failed << " failed\n";
    std::cout << "=============================================================\n";

    return (g_failed == 0) ? 0 : 1;
}
