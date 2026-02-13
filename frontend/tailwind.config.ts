import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // 语义色：盈利/做多使用绿色，亏损/风险使用红色
        profit: {
          DEFAULT: "#10b981" // emerald-500
        },
        risk: {
          DEFAULT: "#f43f5e" // rose-500
        }
      }
    }
  },
  plugins: []
};
export default config;
