import { useEffect } from "react";
import { themeState } from "~/state";

export const useTheme = () => {
  function updateMode() {
    let darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let isSystemDarkMode = darkModeMediaQuery.matches;
    let isDarkMode =
      window.localStorage.isDarkMode === "true" ||
      (!("isDarkMode" in window.localStorage) && isSystemDarkMode);

    themeState.isDarkMode = isDarkMode;
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    if (isDarkMode === isSystemDarkMode) {
      delete window.localStorage.isDarkMode;
    }
  }

  function disableTransitionsTemporarily() {
    document.documentElement.classList.add("[&_*]:!transition-none");
    window.setTimeout(() => {
      document.documentElement.classList.remove("[&_*]:!transition-none");
    }, 0);
  }

  function updateModeWithoutTransitions() {
    disableTransitionsTemporarily();
    updateMode();
  }

  function toggleMode() {
    disableTransitionsTemporarily();

    let darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let isSystemDarkMode = darkModeMediaQuery.matches;
    let isDarkMode = document.documentElement.classList.toggle("dark");

    themeState.isDarkMode = isDarkMode;
    if (isDarkMode === isSystemDarkMode) {
      delete window.localStorage.isDarkMode;
    } else {
      window.localStorage.isDarkMode = isDarkMode;
    }
  }

  useEffect(() => {
    let darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    updateMode();
    darkModeMediaQuery.addEventListener(
      "change",
      updateModeWithoutTransitions,
      { passive: true }
    );
    window.addEventListener("storage", updateModeWithoutTransitions, {
      passive: true,
    });

    return () => {
      darkModeMediaQuery.removeEventListener(
        "change",
        updateModeWithoutTransitions
      );
      window.removeEventListener("storage", updateModeWithoutTransitions);
    };
  }, []);
  return {
    toggleMode,
  };
};
