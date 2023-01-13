import { SunIcon, MoonIcon } from "@heroicons/react/outline";
import { useTheme } from "~/hooks";

export default function ToggleTheme() {
  const { toggleMode } = useTheme();
  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      className="group"
      onClick={toggleMode}
    >
      <SunIcon className="h-6 w-6 fill-gray-100 stroke-gray-500 transition group-hover:fill-gray-200 group-hover:stroke-gray-700 dark:hidden [@media(prefers-color-scheme:dark)]:fill-sky-50 [@media(prefers-color-scheme:dark)]:stroke-sky-500 [@media(prefers-color-scheme:dark)]:group-hover:fill-sky-50 [@media(prefers-color-scheme:dark)]:group-hover:stroke-sky-600" />
      <MoonIcon className="hidden h-6 w-6 fill-gray-700 stroke-gray-500 transition dark:block [@media(prefers-color-scheme:dark)]:group-hover:stroke-gray-400 [@media_not_(prefers-color-scheme:dark)]:fill-sky-400/10 [@media_not_(prefers-color-scheme:dark)]:stroke-sky-500" />
    </button>
  );
}
