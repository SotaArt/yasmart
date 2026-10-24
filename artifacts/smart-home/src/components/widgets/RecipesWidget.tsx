import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, ChefHat } from "lucide-react";
import type { RecipesWidgetData, RecipeItem } from "@/hooks/use-dashboard-layout";

interface RecipesWidgetProps {
  data: RecipesWidgetData;
  onChange?: (data: RecipesWidgetData) => void;
  readOnly?: boolean;
}

export function RecipesWidget({ data, onChange, readOnly = false }: RecipesWidgetProps) {
  const recipes = data.recipes ?? [];
  const [activeIndex, setActiveIndex] = useState(0);
  const recipe = recipes[Math.min(activeIndex, recipes.length - 1)];

  if (recipes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 rounded-2xl bg-[#111113] border border-[#1f1f22]">
        <span className="text-3xl mb-2">🍳</span>
        <span className="text-xs text-neutral-400">Нет рецептов</span>
        <span className="text-[10px] text-neutral-600 mt-1">Добавьте в настройках</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 rounded-2xl bg-[#111113] border border-[#1f1f22] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-lg"><ChefHat className="w-4 h-4 text-[#f3e5ab]" /></span>
        {recipes.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveIndex((i) => (i - 1 + recipes.length) % recipes.length)}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-[10px] text-muted-foreground">
              {Math.min(activeIndex, recipes.length - 1) + 1}/{recipes.length}
            </span>
            <button
              onClick={() => setActiveIndex((i) => (i + 1) % recipes.length)}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Recipe name */}
      <div className="border-b border-[#1f1f22] pb-2 mb-2 shrink-0">
        <p className="text-sm font-semibold text-neutral-100 leading-tight">{recipe.name}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-[#d4af37] uppercase tracking-wider mb-1.5">Ингредиенты</p>
            <ul className="space-y-1">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-[11px] text-neutral-300">
                  <span className="w-1 h-1 rounded-full bg-[#d4af37]/60 mt-1.5 shrink-0" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-[#d4af37] uppercase tracking-wider mb-1.5">Приготовление</p>
            <ol className="space-y-1.5">
              {recipe.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[11px] text-neutral-300 leading-snug">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-[#d4af37]/15 text-[9px] text-[#f3e5ab] flex items-center justify-center font-semibold mt-px">
                    {idx + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

let recipeSeq = 0;
function newRecipeId() {
  return `recipe_${Date.now()}_${recipeSeq++}`;
}

export function RecipesWidgetSettings({
  data,
  onChange,
}: {
  data: RecipesWidgetData;
  onChange: (data: RecipesWidgetData) => void;
}) {
  const recipes = data.recipes ?? [];

  const updateRecipe = (id: string, patch: Partial<RecipeItem>) => {
    onChange({
      recipes: recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const addRecipe = () => {
    onChange({
      recipes: [
        ...recipes,
        { id: newRecipeId(), name: "Новый рецепт", ingredients: [], steps: [] },
      ],
    });
  };

  const removeRecipe = (id: string) => {
    onChange({ recipes: recipes.filter((r) => r.id !== id) });
  };

  return (
    <div className="space-y-4">
      <button
        onClick={addRecipe}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-dashed border-border/60"
      >
        <Plus className="w-3.5 h-3.5" />
        Добавить рецепт
      </button>

      {recipes.length === 0 && (
        <p className="text-[10px] text-muted-foreground/60 text-center">Рецептов пока нет</p>
      )}

      {recipes.map((recipe) => (
        <div key={recipe.id} className="rounded-lg border border-border/50 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <input
              value={recipe.name}
              onChange={(e) => updateRecipe(recipe.id, { name: e.target.value })}
              placeholder="Название рецепта"
              className="flex-1 bg-transparent border border-border/50 rounded px-2 py-1 text-xs"
            />
            <button
              onClick={() => removeRecipe(recipe.id)}
              className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="Удалить рецепт"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Ингредиенты (по одному в строке)</label>
            <textarea
              value={recipe.ingredients.join("\n")}
              onChange={(e) =>
                updateRecipe(recipe.id, {
                  ingredients: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                })
              }
              rows={2}
              className="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-xs resize-none"
              placeholder={"Мука — 200 г\nЯйцо — 2 шт"}
            />
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">Шаги (по одному в строке)</label>
            <textarea
              value={recipe.steps.join("\n")}
              onChange={(e) =>
                updateRecipe(recipe.id, {
                  steps: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                })
              }
              rows={3}
              className="w-full bg-transparent border border-border/50 rounded px-2 py-1 text-xs resize-none"
              placeholder={"Смешать ингредиенты\nЗапекать 20 мин"}
            />
          </div>
        </div>
      ))}
    </div>
  );
}