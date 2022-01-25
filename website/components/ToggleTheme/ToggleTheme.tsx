import React from "react";
import useTheme from "~/hooks/useTheme";
import { SunIcon, MoonIcon } from "@heroicons/react/outline";

export default function ToggleTheme() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div onClick={() => toggleTheme()} className="text-gray-600">
      {theme === "light" ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <MoonIcon className="h-5 w-5" />
      )}
    </div>
  );
}
