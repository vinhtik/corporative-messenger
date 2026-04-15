import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { themePresets } from "@/lib/theme-presets";
import {
  buildThemePalette,
  colorFieldList,
  createEmptyThemeDraft,
} from "@/lib/theme-utils";

const ThemeMiniPreview = ({ palette }) => {
  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{
        backgroundColor: palette.background,
        color: palette.foreground,
        borderColor: palette.border,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          backgroundColor: palette.sidebar,
          color: palette.sidebarForeground,
        }}
      >
        <span className="text-xs font-medium">Sidebar</span>
        <div className="flex gap-1">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: palette.sidebarPrimary }}
          />
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: palette.sidebarAccent }}
          />
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div
          className="rounded-md px-3 py-2 text-xs"
          style={{
            backgroundColor: palette.card,
            color: palette.cardForeground,
            border: `1px solid ${palette.border}`,
          }}
        >
          Card preview
        </div>

        <div className="flex gap-2">
          <span
            className="rounded-md px-3 py-1 text-xs"
            style={{
              backgroundColor: palette.primary,
              color: palette.primaryForeground,
            }}
          >
            Primary
          </span>

          <span
            className="rounded-md px-3 py-1 text-xs"
            style={{
              backgroundColor: palette.secondary,
              color: palette.secondaryForeground,
            }}
          >
            Secondary
          </span>
        </div>
      </div>
    </div>
  );
};

const ThemeChatPreview = ({ palette, title = "Live preview" }) => {
  const incomingBubbleStyle = {
    backgroundColor: palette.card,
    color: palette.cardForeground,
    border: `1px solid ${palette.border}`,
    borderRadius: "18px 18px 18px 8px",
  };

  const outgoingBubbleStyle = {
    backgroundColor: palette.primary,
    color: palette.primaryForeground,
    border: `1px solid ${palette.primary}`,
    borderRadius: "18px 18px 8px 18px",
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: palette.background,
        color: palette.foreground,
        borderColor: palette.border,
      }}
    >
      <div
        className="grid min-h-[420px] md:grid-cols-[220px_1fr]"
        style={{ backgroundColor: palette.background }}
      >
        <div
          className="hidden md:flex md:flex-col"
          style={{
            backgroundColor: palette.sidebar,
            color: palette.sidebarForeground,
            borderRight: `1px solid ${palette.sidebarBorder}`,
          }}
        >
          <div className="px-4 py-4 text-sm font-semibold">{title}</div>

          <div className="space-y-2 px-3 pb-3">
            <div
              className="rounded-xl px-3 py-2"
              style={{
                backgroundColor: palette.sidebarAccent,
                color: palette.sidebarAccentForeground,
              }}
            >
              Диалоги
            </div>

            <div className="rounded-xl px-3 py-2 opacity-80">Группы</div>
            <div className="rounded-xl px-3 py-2 opacity-70">Профиль</div>
          </div>

          <div className="mt-auto px-3 py-3">
            <div
              className="rounded-xl px-3 py-2"
              style={{
                backgroundColor: palette.sidebarPrimary,
                color: palette.sidebarPrimaryForeground,
              }}
            >
              User panel
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{
              borderBottom: `1px solid ${palette.border}`,
              backgroundColor: palette.background,
              color: palette.foreground,
            }}
          >
            <div>
              <div className="font-medium">Anastasia</div>
              <div
                className="text-xs"
                style={{ color: palette.mutedForeground }}
              >
                online · header text
              </div>
            </div>

            <div className="flex gap-2">
              <span
                className="rounded-lg px-3 py-1 text-xs"
                style={{
                  backgroundColor: palette.accent,
                  color: palette.accentForeground,
                }}
              >
                Call
              </span>
              <span
                className="rounded-lg px-3 py-1 text-xs"
                style={{
                  backgroundColor: palette.secondary,
                  color: palette.secondaryForeground,
                }}
              >
                Settings
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-4 p-4">
            <div className="text-center text-xs" style={{ color: palette.mutedForeground }}>
              14 April 2026
            </div>

            <div className="max-w-[75%] px-3 py-2 text-sm" style={incomingBubbleStyle}>
              <div>Пример входящего сообщения</div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: palette.mutedForeground }}
              >
                muted time text
              </div>
            </div>

            <div className="ml-auto max-w-[75%] px-3 py-2 text-sm" style={outgoingBubbleStyle}>
              <div>Пример исходящего bubble</div>
              <div className="mt-1 text-[11px]" style={{ opacity: 0.8 }}>
                primary foreground text
              </div>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor: palette.card,
                color: palette.cardForeground,
                border: `1px solid ${palette.border}`,
              }}
            >
              <div className="font-medium">Card / dialog preview</div>
              <div
                className="mt-1 text-sm"
                style={{ color: palette.mutedForeground }}
              >
                Здесь видно card, border, обычный текст и muted text.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className="rounded-lg px-3 py-1 text-xs"
                  style={{
                    backgroundColor: palette.primary,
                    color: palette.primaryForeground,
                  }}
                >
                  Primary button
                </span>

                <span
                  className="rounded-lg px-3 py-1 text-xs"
                  style={{
                    backgroundColor: palette.secondary,
                    color: palette.secondaryForeground,
                  }}
                >
                  Secondary
                </span>

                <span
                  className="rounded-lg px-3 py-1 text-xs"
                  style={{
                    backgroundColor: palette.accent,
                    color: palette.accentForeground,
                  }}
                >
                  Accent
                </span>
              </div>
            </div>
          </div>

          <div
            className="p-4"
            style={{
              borderTop: `1px solid ${palette.border}`,
              backgroundColor: palette.background,
            }}
          >
            <div
              className="flex items-center gap-3 rounded-2xl px-3 py-3"
              style={{
                backgroundColor: palette.card,
                color: palette.cardForeground,
                border: `1px solid ${palette.input}`,
              }}
            >
              <span style={{ color: palette.mutedForeground }}>😊</span>

              <div
                className="flex-1 text-sm"
                style={{ color: palette.mutedForeground }}
              >
                Input placeholder
              </div>

              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-medium"
                style={{
                  backgroundColor: palette.primary,
                  color: palette.primaryForeground,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ThemePreviewCard = ({
  title,
  subtitle,
  palette,
  isActive,
  onClick,
  actions,
}) => {
  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isActive
          ? "border-primary ring-2 ring-primary/25"
          : "border-border hover:border-primary/40"
      }`}
    >
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">{title}</div>
            {subtitle ? (
              <div className="text-sm text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>

          {isActive ? (
            <span className="rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
              Active
            </span>
          ) : null}
        </div>

        <ThemeMiniPreview palette={palette} />
      </button>

      {actions ? <div className="mt-3 flex gap-2">{actions}</div> : null}
    </div>
  );
};

const ThemeSettings = () => {
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);

  const activePreset = useAppStore((state) => state.activePreset);
  const setPreset = useAppStore((state) => state.setPreset);

  const activeThemeSource = useAppStore((state) => state.activeThemeSource);
  const activeCustomThemeId = useAppStore((state) => state.activeCustomThemeId);

  const customThemes = useAppStore((state) => state.customThemes);
  const saveCustomTheme = useAppStore((state) => state.saveCustomTheme);
  const activateCustomTheme = useAppStore((state) => state.activateCustomTheme);
  const removeCustomTheme = useAppStore((state) => state.removeCustomTheme);

  const [editingThemeId, setEditingThemeId] = useState(null);
  const [draft, setDraft] = useState(createEmptyThemeDraft("light"));

  const draftPalette = useMemo(() => buildThemePalette(draft.colors), [draft.colors]);

  const lightCustomThemes = useMemo(
    () => customThemes.filter((item) => item.mode === "light"),
    [customThemes]
  );

  const darkCustomThemes = useMemo(
    () => customThemes.filter((item) => item.mode === "dark"),
    [customThemes]
  );

  const updateDraftColor = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const updateDraftMode = (mode) => {
    setEditingThemeId(null);
    setDraft(createEmptyThemeDraft(mode));
  };

  const startEditTheme = (theme) => {
    setEditingThemeId(theme.id);
    setDraft({
      name: theme.name,
      mode: theme.mode,
      colors: { ...theme.colors },
    });
  };

  const resetDraft = () => {
    setEditingThemeId(null);
    setDraft(createEmptyThemeDraft(draft.mode));
  };

  const handleSaveTheme = () => {
    const trimmedName = draft.name.trim();

    if (!trimmedName) {
      toast.error("Название темы обязательно");
      return;
    }

    const theme = {
      id: editingThemeId || crypto.randomUUID(),
      name: trimmedName,
      mode: draft.mode,
      colors: { ...draft.colors },
      palette: buildThemePalette(draft.colors),
    };

    saveCustomTheme(theme);
    setEditingThemeId(theme.id);
    toast.success("Тема сохранена");
  };

  const handleDeleteTheme = (theme) => {
    removeCustomTheme(theme.id);

    if (editingThemeId === theme.id) {
      setEditingThemeId(null);
      setDraft(createEmptyThemeDraft(theme.mode));
    }

    toast.success(`Тема "${theme.name}" удалена`);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Темы приложения</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Здесь можно выбрать режим, готовые темы и сделать свои с живым превью.
        </p>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium">Режим отображения</div>
        <div className="flex flex-wrap gap-3">
          {["system", "light", "dark"].map((mode) => (
            <Button
              key={mode}
              type="button"
              variant={themeMode === mode ? "default" : "outline"}
              onClick={() => setThemeMode(mode)}
              className="capitalize"
            >
              {mode === "system"
                ? "System"
                : mode === "light"
                ? "Light"
                : "Dark"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Светлые пресеты</h3>
            <p className="text-sm text-muted-foreground">
              Готовые темы для light-режима
            </p>
          </div>

          <div className="grid gap-3">
            {Object.entries(themePresets.light).map(([name, palette]) => (
              <ThemePreviewCard
                key={name}
                title={name}
                subtitle="Preset"
                palette={palette}
                isActive={
                  activeThemeSource.light === "preset" &&
                  activePreset.light === name
                }
                onClick={() => setPreset("light", name)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Тёмные пресеты</h3>
            <p className="text-sm text-muted-foreground">
              Готовые темы для dark-режима
            </p>
          </div>

          <div className="grid gap-3">
            {Object.entries(themePresets.dark).map(([name, palette]) => (
              <ThemePreviewCard
                key={name}
                title={name}
                subtitle="Preset"
                palette={palette}
                isActive={
                  activeThemeSource.dark === "preset" &&
                  activePreset.dark === name
                }
                onClick={() => setPreset("dark", name)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Мои светлые темы</h3>
            <p className="text-sm text-muted-foreground">
              Пользовательские темы для light
            </p>
          </div>

          {lightCustomThemes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Пока нет своих светлых тем
            </div>
          ) : (
            <div className="grid gap-3">
              {lightCustomThemes.map((theme) => (
                <ThemePreviewCard
                  key={theme.id}
                  title={theme.name}
                  subtitle="Custom"
                  palette={theme.palette}
                  isActive={
                    activeThemeSource.light === "custom" &&
                    activeCustomThemeId.light === theme.id
                  }
                  onClick={() => activateCustomTheme("light", theme.id)}
                  actions={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startEditTheme(theme)}
                      >
                        <Pencil className="size-4" />
                        Редактировать
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTheme(theme)}
                      >
                        <Trash2 className="size-4" />
                        Удалить
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Мои тёмные темы</h3>
            <p className="text-sm text-muted-foreground">
              Пользовательские темы для dark
            </p>
          </div>

          {darkCustomThemes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Пока нет своих тёмных тем
            </div>
          ) : (
            <div className="grid gap-3">
              {darkCustomThemes.map((theme) => (
                <ThemePreviewCard
                  key={theme.id}
                  title={theme.name}
                  subtitle="Custom"
                  palette={theme.palette}
                  isActive={
                    activeThemeSource.dark === "custom" &&
                    activeCustomThemeId.dark === theme.id
                  }
                  onClick={() => activateCustomTheme("dark", theme.id)}
                  actions={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startEditTheme(theme)}
                      >
                        <Pencil className="size-4" />
                        Редактировать
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTheme(theme)}
                      >
                        <Trash2 className="size-4" />
                        Удалить
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.2fr]">
        <div className="space-y-5 rounded-2xl border border-border bg-background/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {editingThemeId ? "Редактирование темы" : "Новая кастомная тема"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Цвета меняются в превью сразу
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={draft.mode === "light" ? "default" : "outline"}
                onClick={() => updateDraftMode("light")}
              >
                Light
              </Button>
              <Button
                type="button"
                variant={draft.mode === "dark" ? "default" : "outline"}
                onClick={() => updateDraftMode("dark")}
              >
                Dark
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Название темы</label>
            <Input
              value={draft.name}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Например: My Ocean"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {colorFieldList.map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-medium">{field.label}</label>

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={draft.colors[field.key]}
                    onChange={(e) => updateDraftColor(field.key, e.target.value)}
                    className="h-11 w-16 cursor-pointer rounded-md border border-border bg-transparent p-1"
                  />

                  <Input
                    value={draft.colors[field.key]}
                    onChange={(e) => updateDraftColor(field.key, e.target.value)}
                    placeholder="#000000"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={handleSaveTheme}>
              {editingThemeId ? "Сохранить изменения" : "Сохранить тему"}
            </Button>

            <Button type="button" variant="outline" onClick={resetDraft}>
              Сбросить форму
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">Превью</h3>
          </div>

          <ThemeChatPreview
            palette={draftPalette}
            title={draft.name.trim() || "Draft preview"}
          />
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
