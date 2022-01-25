import { useCallback, useEffect, useState } from "react";

type themeType = "light" | "dark";

export default function useTheme() {
  const [theme, setTheme] = useState<themeType | null>(null);

  const setCurrentTheme = useCallback(
    (theme: themeType = "light") => {
      // On page load or when changing themes, best to add inline in `head` to avoid FOUC
      if (
        localStorage.theme === "dark" ||
        (!("theme" in localStorage) &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      setTheme(theme);
    },
    [theme, setTheme]
  );

  const toggleTheme = useCallback(
    () =>
      theme === "light" ? setCurrentTheme("dark") : setCurrentTheme("light"),
    [theme, setCurrentTheme]
  );

  useEffect(() => {
    const currentTheme = localStorage.getItem("preferredTheme") as themeType;
    if (currentTheme) {
      setCurrentTheme(currentTheme);
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setCurrentTheme("dark");
      } else {
        setCurrentTheme("light");
      }
    }
  }, []);

  // const hasDarkMode = useCallback(() => {
  //   return document.documentElement.classList.contains("dark");
  // }, []);

  // const setCurrentTheme = useCallback(
  //   (theme: themeType = "light") => {
  //     if (theme === "light") nightwind.enable(false);
  //     else nightwind.enable(true);
  //     setTheme(theme);
  //   },
  //   [theme, setTheme]
  // );

  // const toggleTheme = useCallback(
  //   () =>
  //     theme === "light" ? setCurrentTheme("dark") : setCurrentTheme("light"),
  //   [theme, setCurrentTheme]
  // );

  // useEffect(() => {
  //   if (hasDarkMode()) {
  //     setTheme("dark");
  //   } else {
  //     setTheme("light");
  //   }
  // });

  return {
    theme,
    toggleTheme,
    setCurrentTheme,
  } as const;
}
