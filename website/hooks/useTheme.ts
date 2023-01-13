import { useCallback, useEffect } from "react";
import { themeState } from "~/state";

export const useTheme = () => {
  const updateMode = useCallback(() => {
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
  }, []);

  const disableTransitionsTemporarily = useCallback(() => {
    document.documentElement.classList.add("[&_*]:!transition-none");
    window.setTimeout(() => {
      document.documentElement.classList.remove("[&_*]:!transition-none");
    }, 0);
  }, []);

  const updateModeWithoutTransitions = useCallback(() => {
    disableTransitionsTemporarily();
    updateMode();
  }, [updateMode, disableTransitionsTemporarily]);

  const toggleMode = useCallback(() => {
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
  }, [disableTransitionsTemporarily]);

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
