/* eslint-disable @typescript-eslint/no-var-requires */
const colors = require("tailwindcss/colors");

module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "../docs/**/*.{.md,.mdx}",
  ],
  theme: {
    colors: {
      ...colors,
      gray: {
        ...colors.neutral,
        350: "#bcbcbc",
      },
    },
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
