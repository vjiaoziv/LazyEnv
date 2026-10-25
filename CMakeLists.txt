# =============================================================================
# LazyEnv - CMakeLists.txt
# Build configuration for the LazyEnv development environment setup tool
# =============================================================================
cmake_minimum_required(VERSION 3.24)

project(LazyEnv
    VERSION   0.8.14
    LANGUAGES CXX
)

# ---------------------------------------------------------------------------
# C++23 standard
# ---------------------------------------------------------------------------
set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ---------------------------------------------------------------------------
# Platform check
# ---------------------------------------------------------------------------
if(NOT WIN32)
    message(FATAL_ERROR "LazyEnv currently supports Windows only.")
endif()

# ---------------------------------------------------------------------------
# WebView2 SDK via NuGet (fetched automatically)
# ---------------------------------------------------------------------------
include(FetchContent)

FetchContent_Declare(
    webview2
    URL      https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2903.40
    DOWNLOAD_NO_EXTRACT FALSE
)

FetchContent_Declare(
    wil
    URL      https://www.nuget.org/api/v2/package/Microsoft.Windows.ImplementationLibrary/1.0.240803.1
    DOWNLOAD_NO_EXTRACT FALSE
)

FetchContent_MakeAvailable(webview2 wil)

# Locate WebView2 headers and libraries
set(WEBVIEW2_INCLUDE_DIR "${webview2_SOURCE_DIR}/build/native/include")
set(WIL_INCLUDE_DIR      "${wil_SOURCE_DIR}/include")

# Determine architecture-specific lib path
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
    set(WEBVIEW2_LIB_DIR "${webview2_SOURCE_DIR}/build/native/x64")
else()
    set(WEBVIEW2_LIB_DIR "${webview2_SOURCE_DIR}/build/native/x86")
endif()

# ---------------------------------------------------------------------------
# Source files
# ---------------------------------------------------------------------------
set(SOURCES
    main.cpp
    webview_host.cpp
    webview_host.h
    installer.cpp
    installer.h
    rollback.cpp
    rollback.h
    package_manager.cpp
    package_manager.h
    update_manager.cpp
    update_manager.h
    path_doctor.cpp
    path_doctor.h
    recipe_manager.cpp
    recipe_manager.h
)

# ---------------------------------------------------------------------------
# Resource file (icon + version info)
# ---------------------------------------------------------------------------
# --- Resource file (icon + version info) — generated from LazyEnv.rc.in ----
# Single source of truth for the version: project(VERSION ...) above.
string(REPLACE "." "," LAZYENV_RC_VERSION "${PROJECT_VERSION}")
set(LAZYENV_RC_VERSION "${LAZYENV_RC_VERSION},0")
configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/LazyEnv.rc.in"
    "${CMAKE_CURRENT_BINARY_DIR}/LazyEnv.rc"
    @ONLY
)
set(RESOURCE_FILE "${CMAKE_CURRENT_BINARY_DIR}/LazyEnv.rc")

# ---------------------------------------------------------------------------
# Executable (WIN32 = no console window)
# ---------------------------------------------------------------------------
add_executable(LazyEnv WIN32
    ${SOURCES}
    ${RESOURCE_FILE}
)

# ---------------------------------------------------------------------------
# Include directories
# ---------------------------------------------------------------------------
target_include_directories(LazyEnv PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${WEBVIEW2_INCLUDE_DIR}
    ${WIL_INCLUDE_DIR}
)

# ---------------------------------------------------------------------------
# Link libraries
# ---------------------------------------------------------------------------
target_link_libraries(LazyEnv PRIVATE
    ${WEBVIEW2_LIB_DIR}/WebView2LoaderStatic.lib
    Shlwapi.lib
    Ole32.lib
    Shell32.lib
    Advapi32.lib
    User32.lib
    Gdi32.lib
    Dwmapi.lib
    Shcore.lib
)

# ---------------------------------------------------------------------------
# Compiler options
# ---------------------------------------------------------------------------
if(MSVC)
    target_compile_options(LazyEnv PRIVATE
        /W4         # Warning level 4
        /utf-8      # Source and execution charset UTF-8
        /permissive-
        /Zc:__cplusplus
    )
    # Suppress specific warnings that are noisy with Win32 API
    target_compile_definitions(LazyEnv PRIVATE
        _CRT_SECURE_NO_WARNINGS
        NOMINMAX
        WIN32_LEAN_AND_MEAN
        UNICODE
        _UNICODE
        LAZYENV_VERSION_STRING="${PROJECT_VERSION}"
    )
elseif(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
    target_compile_options(LazyEnv PRIVATE
        -Wall -Wextra -Wpedantic
    )
    target_compile_definitions(LazyEnv PRIVATE
        NOMINMAX
        WIN32_LEAN_AND_MEAN
        UNICODE
        _UNICODE
        LAZYENV_VERSION_STRING="${PROJECT_VERSION}"
    )
endif()

# ---------------------------------------------------------------------------
# Post-build: copy resources next to executable
# ---------------------------------------------------------------------------
add_custom_command(TARGET LazyEnv POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory
        "$<TARGET_FILE_DIR:LazyEnv>/resources"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/index.html"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/index.html"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/style.css"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/style.css"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/script.js"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/script.js"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/i18n.js"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/i18n.js"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/icons.js"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/icons.js"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/lazyenv.ico"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/lazyenv.ico"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/resources/lazyenv.png"
        "$<TARGET_FILE_DIR:LazyEnv>/resources/lazyenv.png"
    # Stamp the display version in the copied index.html from project(VERSION)
    COMMAND ${CMAKE_COMMAND}
        "-DLAZYENV_VERSION=${PROJECT_VERSION}"
        "-DINDEX_HTML=$<TARGET_FILE_DIR:LazyEnv>/resources/index.html"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/StampVersion.cmake"
    COMMENT "Copying web resources to output directory"
)

# ---------------------------------------------------------------------------
# Install rules
# ---------------------------------------------------------------------------
install(TARGETS LazyEnv RUNTIME DESTINATION bin)
install(DIRECTORY resources/ DESTINATION bin/resources
    FILES_MATCHING
    PATTERN "*.html"
    PATTERN "*.css"
    PATTERN "*.js"
    PATTERN "*.ico"
    PATTERN "*.png"
)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
message(STATUS "")
message(STATUS "  LazyEnv v${PROJECT_VERSION}")
message(STATUS "  C++ Standard:    ${CMAKE_CXX_STANDARD}")
message(STATUS "  Compiler:        ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "  WebView2 SDK:    ${WEBVIEW2_INCLUDE_DIR}")
message(STATUS "  WIL:             ${WIL_INCLUDE_DIR}")
message(STATUS "")

# ---------------------------------------------------------------------------
# Test executable
# ---------------------------------------------------------------------------
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/tests/test_v0814.cpp")
    add_executable(test_v0814
        tests/test_v0814.cpp
        installer.cpp
        rollback.cpp
        path_doctor.cpp
        package_manager.cpp
        recipe_manager.cpp
        update_manager.cpp
    )
    target_include_directories(test_v0814 PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}
        ${WEBVIEW2_INCLUDE_DIR}
        ${WIL_INCLUDE_DIR}
    )
    target_link_libraries(test_v0814 PRIVATE
        Shlwapi.lib
        Ole32.lib
        Shell32.lib
        Advapi32.lib
        User32.lib
        Gdi32.lib
        Dwmapi.lib
        Shcore.lib
    )
    if(MSVC)
        target_compile_options(test_v0814 PRIVATE /W4 /utf-8 /permissive- /Zc:__cplusplus)
        target_compile_definitions(test_v0814 PRIVATE
            _CRT_SECURE_NO_WARNINGS
            NOMINMAX
            WIN32_LEAN_AND_MEAN
            UNICODE
            _UNICODE
            LAZYENV_VERSION_STRING="${PROJECT_VERSION}"
        )
    endif()
endif()