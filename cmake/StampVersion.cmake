# StampVersion.cmake — invoked at POST_BUILD to sync the display version in
# the copied resources/index.html with the single source of truth:
#   project(LazyEnv VERSION x.y.z) in CMakeLists.txt
#
# Usage: cmake -DLAZYENV_VERSION=<ver> -P StampVersion.cmake <index.html path>

if(NOT DEFINED LAZYENV_VERSION OR NOT DEFINED INDEX_HTML)
    message(FATAL_ERROR "StampVersion.cmake: LAZYENV_VERSION and INDEX_HTML must be defined")
endif()

if(NOT EXISTS "${INDEX_HTML}")
    message(FATAL_ERROR "StampVersion.cmake: '${INDEX_HTML}' not found")
endif()

file(READ "${INDEX_HTML}" _content)
string(REGEX REPLACE "LazyEnv v[0-9]+\\.[0-9]+\\.[0-9]+" "LazyEnv v${LAZYENV_VERSION}" _content "${_content}")
file(WRITE "${INDEX_HTML}" "${_content}")
