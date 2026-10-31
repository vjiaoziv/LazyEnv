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

std::vector<std::string> extractJsonArray(const std::string& json,
                                          const std::string& key) {
    std::vector<std::string> result;
    std::string needle = "\"" + key + "\"";
    auto pos = json.find(needle);
    if (pos == std::string::npos) return result;

    pos = json.find(':', pos + needle.size());
    if (pos == std::string::npos) return result;

    pos = json.find('[', pos);
    if (pos == std::string::npos) return result;

    bool inString = false;
    std::string current;
    for (size_t i = pos + 1; i < json.size(); ++i) {
        char c = json[i];
        if (inString) {
            if (c == '\\' && i + 1 < json.size()) {
                ++i;
                char next = json[i];
                switch (next) {
                    case '\"': current += '\"'; break;
                    case '\\': current += '\\'; break;
                    case '/':  current += '/';  break;
                    case 'b':  current += '\b'; break;
                    case 'f':  current += '\f'; break;
                    case 'n':  current += '\n'; break;
                    case 'r':  current += '\r'; break;
                    case 't':  current += '\t'; break;
                    default:   current += next; break;
                }
            } else if (c == '\"') {
                inString = false;
                result.push_back(current);
                current.clear();
            } else {
                current += c;
            }
        } else {
            if (c == '\"') {
                inString = true;
                current.clear();
            } else if (c == ']') {
                break;
            }
        }
    }
    return result;
}

std::wstring utf8ToWide(const std::string& s) {
    if (s.empty()) return {};
    int len = MultiByteToWideChar(CP_UTF8, 0, s.data(),
                                  static_cast<int>(s.size()), nullptr, 0);
    std::wstring ws; ws.resize(len);
    MultiByteToWideChar(CP_UTF8, 0, s.data(),
                        static_cast<int>(s.size()), ws.data(), len);
    return ws;
}

int main() {
    int passed = 0;
    int failed = 0;
    auto test = [&](const std::string& name, bool cond) {
        if (cond) {
            std::cout << "  [PASS] " << name << "\n";
            passed++;
        } else {
            std::cout << "  [FAIL] " << name << "\n";
            failed++;
        }
    };

    std::cout << "=== Running LazyEnv v0.8.14 Automated Verification Suite ===\n\n";

    // -------------------------------------------------------------
    // Test 1: extractJsonArray parser robustness
    // -------------------------------------------------------------
    std::cout << "[Test Group 1: extractJsonArray Robustness]\n";
    {
        std::string json1 = R"({"missingPackageIds":["Git.Git","Python.Python.3.12"]})";
        auto arr1 = extractJsonArray(json1, "missingPackageIds");
        test("Basic 2 elements", arr1.size() == 2 && arr1[0] == "Git.Git" && arr1[1] == "Python.Python.3.12");

        std::string jsonEmpty = R"({"items":[]})";
        auto arrEmpty = extractJsonArray(jsonEmpty, "items");
        test("Empty array", arrEmpty.empty());

        std::string jsonBrackets = R"({"packages":["node[v20]","foo]bar","[baz]"]})";
        auto arrBrackets = extractJsonArray(jsonBrackets, "packages");
        test("Embedded brackets in strings", arrBrackets.size() == 3 && arrBrackets[0] == "node[v20]" && arrBrackets[1] == "foo]bar" && arrBrackets[2] == "[baz]");

        std::string jsonEscapes = R"({"items":["val\"with\"quotes","line1\nline2","path\\to\\dir"]})";
        auto arrEscapes = extractJsonArray(jsonEscapes, "items");
        test("Escaped characters and quotes", arrEscapes.size() == 3 && arrEscapes[0] == "val\"with\"quotes" && arrEscapes[1] == "line1\nline2" && arrEscapes[2] == "path\\to\\dir");
    }

    // -------------------------------------------------------------
    // Test 2: Compound PATH Add / Remove & Idempotency
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 2: Compound PATH Add/Remove & Idempotency]\n";
    {
        std::string origPath = lazyenv::RollbackManager::readEnvVariable("Path", false);
        std::string compound = "C:\\LazyEnvTestPath1;C:\\LazyEnvTestPath2";

        lazyenv::Installer::removeFromUserPath(compound);

        bool ok1 = lazyenv::Installer::addToUserPath(compound);
        test("addToUserPath 1st call ok", ok1);
        std::string pathAfter1 = lazyenv::RollbackManager::readEnvVariable("Path", false);
        test("Path contains LazyEnvTestPath1", pathAfter1.find("LazyEnvTestPath1") != std::string::npos);
        test("Path contains LazyEnvTestPath2", pathAfter1.find("LazyEnvTestPath2") != std::string::npos);

        auto countOccurrences = [](const std::string& p, const std::string& sub) {
            size_t count = 0;
            size_t pos = 0;
            while ((pos = p.find(sub, pos)) != std::string::npos) {
                count++;
                pos += sub.size();
            }
            return count;
        };

        test("LazyEnvTestPath1 appears exactly once", countOccurrences(pathAfter1, "LazyEnvTestPath1") == 1);
        test("LazyEnvTestPath2 appears exactly once", countOccurrences(pathAfter1, "LazyEnvTestPath2") == 1);

        bool ok2 = lazyenv::Installer::addToUserPath(compound);
        test("addToUserPath 2nd call idempotent ok", ok2);
        std::string pathAfter2 = lazyenv::RollbackManager::readEnvVariable("Path", false);
        test("Path after 2nd call identical length", pathAfter1 == pathAfter2);

        bool okRem = lazyenv::Installer::removeFromUserPath(compound);
        test("removeFromUserPath compound ok", okRem);
        std::string pathAfterRem = lazyenv::RollbackManager::readEnvVariable("Path", false);
        test("LazyEnvTestPath1 completely removed", pathAfterRem.find("LazyEnvTestPath1") == std::string::npos);
        test("LazyEnvTestPath2 completely removed", pathAfterRem.find("LazyEnvTestPath2") == std::string::npos);

        lazyenv::RollbackManager::writeEnvVariable("Path", origPath, REG_EXPAND_SZ, false);
    }

    // -------------------------------------------------------------
    // Test 3: PathDoctor reorderPath (up, down, top, bottom)
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 3: PathDoctor Multi-directional Reordering]\n";
    {
        std::string origPath = lazyenv::RollbackManager::readEnvVariable("Path", false);
        lazyenv::RollbackManager rollback;

        std::string testSetup = "C:\\LazyEnvTestA;C:\\LazyEnvTestB;C:\\LazyEnvTestC";
        lazyenv::Installer::addToUserPath(testSetup);

        std::string snapId;
        bool okTop = lazyenv::PathDoctor::reorderPath("C:\\LazyEnvTestC", "top", false, rollback, snapId);
        test("reorderPath 'top' succeeded", okTop);
        std::string pathAfterTop = lazyenv::RollbackManager::readEnvVariable("Path", false);
        test("C is moved to the very front of PATH", pathAfterTop.find("C:\\LazyEnvTestC") == 0);

        bool okDown = lazyenv::PathDoctor::reorderPath("C:\\LazyEnvTestA", "down", false, rollback, snapId);
        test("reorderPath 'down' succeeded", okDown);
        std::string pathAfterDown = lazyenv::RollbackManager::readEnvVariable("Path", false);
        test("A is swapped after B", pathAfterDown.find("C:\\LazyEnvTestB;C:\\LazyEnvTestA") != std::string::npos);

        bool okUp = lazyenv::PathDoctor::reorderPath("C:\\LazyEnvTestA", "up", false, rollback, snapId);
        test("reorderPath 'up' succeeded", okUp);
        std::string pathAfterUp = lazyenv::RollbackManager::readEnvVariable("Path", false);
        test("A is moved back before B", pathAfterUp.find("C:\\LazyEnvTestA;C:\\LazyEnvTestB") != std::string::npos);

        lazyenv::Installer::removeFromUserPath(testSetup);
        lazyenv::RollbackManager::writeEnvVariable("Path", origPath, REG_EXPAND_SZ, false);
    }

    std::cout << "\n[Test Group 4: PathDoctor addPath & removePath]\n";
    {
        std::string origPath = lazyenv::RollbackManager::readEnvVariable("Path", false);
        lazyenv::RollbackManager rollback;

        std::string snapId;
        std::string testPath = "C:\\LazyEnvAddTest";
        lazyenv::PathDoctor::removePath(testPath, false, rollback, snapId);

        bool addOk = lazyenv::PathDoctor::addPath(testPath, false, rollback, snapId);
        test("addPath succeeded", addOk);
        test("Snapshot created for addPath", !snapId.empty());
        std::string pAfterAdd = lazyenv::RollbackManager::readEnvVariable("Path", false);
        test("Path contains LazyEnvAddTest", pAfterAdd.find("LazyEnvAddTest") != std::string::npos);

        bool remOk = lazyenv::PathDoctor::removePath(testPath, false, rollback, snapId);
        test("removePath succeeded", remOk);
        std::string pAfterRem = lazyenv::RollbackManager::readEnvVariable("Path", false);
        test("Path no longer contains LazyEnvAddTest", pAfterRem.find("LazyEnvAddTest") == std::string::npos);

        lazyenv::RollbackManager::writeEnvVariable("Path", origPath, REG_EXPAND_SZ, false);
    }

    // -------------------------------------------------------------
    // Test 5: Version Consistency Check
    // -------------------------------------------------------------
    std::cout << "\n[Test Group 5: Version Consistency]\n";
    {
        std::string ver = LAZYENV_VERSION_STRING;
        test("Version matches LAZYENV_VERSION_STRING", ver == LAZYENV_VERSION_STRING);
    }

    std::cout << "\n=============================================================\n";
    std::cout << "Test Summary: " << passed << " passed, " << failed << " failed\n";
    std::cout << "=============================================================\n";

    return (failed == 0) ? 0 : 1;
}