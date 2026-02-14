"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { getSettings, updateSettings, AppSettings } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState<AppSettings>({ totalCapital: 1_000_000, riskPercent: 0.01 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => setForm({ totalCapital: s.totalCapital, riskPercent: s.riskPercent }))
      .catch(() => setError("加载设置失败"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateSettings(form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const riskPercentDisplay = (form.riskPercent * 100).toFixed(2);

  return (
    <main className="space-y-6">
      {/* 返回 */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>

      <div>
        <h2 className="text-lg font-semibold text-slate-100">交易参数设置</h2>
        <p className="mt-1 text-sm text-slate-400">
          配置总资金和单笔风险百分比，用于计算建议仓位
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                总资金（元）
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1000}
                step={1}
                value={form.totalCapital || ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, totalCapital: Number(e.target.value) || 0 }))
                }
                placeholder="例如 1000000"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">
                用于仓位计算：建议仓位 = (总资金 × 风险%) / 止损价差
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                单笔风险百分比（%）
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={0.1}
                max={10}
                step="any"
                value={form.riskPercent ? (form.riskPercent * 100).toString() : ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    riskPercent: isFinite(val) ? val / 100 : 0.01
                  }));
                }}
                placeholder="例如 1 表示 1%"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-base font-mono text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mt-1 text-xs text-slate-500">
                单笔交易最大亏损不超过总资金的 {riskPercentDisplay}%
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              保存成功
            </div>
          )}

          <button
            type="submit"
            disabled={saving || form.totalCapital < 1000 || form.riskPercent <= 0 || form.riskPercent > 0.1}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存设置
          </button>
        </form>
      )}
    </main>
  );
}
