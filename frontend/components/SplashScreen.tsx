"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLOGAN = "计划你的交易，交易你的计划";
const DISPLAY_DURATION_MS = 2000;
const SESSION_KEY = "tradermind_splash_seen";

/**
 * 启动页动画
 * 首次加载时全屏显示 Slogan，2 秒后消失
 * 使用 sessionStorage 记录，每会话仅显示一次
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = sessionStorage.getItem(SESSION_KEY);
    if (seen) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVisible(false);
    }, DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.p
            className="text-center text-xl sm:text-2xl font-semibold px-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            {SLOGAN}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
