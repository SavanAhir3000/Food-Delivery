import React, { useContext, useMemo, useState, useEffect, useCallback } from "react";
import "./FoodDisplay.css";
import { StoreContext } from "../../context/StoreContext";
import { useTheme } from "../../context/ThemeContext";
import FoodItem from "../FoodItem/FoodItem";
import axios from "axios";

// ── Skeleton Loader Card ───────────────────────────────────────────────────────
const SkeletonCard = ({ dark }) => (
  <div className={`rounded-2xl overflow-hidden border animate-pulse ${dark ? "bg-brand-card border-brand-border" : "bg-white border-brand-lightBorder"}`}>
    <div className={`aspect-[4/3] ${dark ? "bg-brand-border" : "bg-slate-200"}`} />
    <div className="p-4 space-y-3">
      <div className={`h-4 rounded ${dark ? "bg-brand-border" : "bg-slate-200"} w-3/4`} />
      <div className={`h-3 rounded ${dark ? "bg-brand-border" : "bg-slate-200"}`} />
      <div className={`h-3 rounded ${dark ? "bg-brand-border" : "bg-slate-200"} w-2/3`} />
      <div className={`h-5 rounded ${dark ? "bg-brand-border" : "bg-slate-200"} w-1/3 mt-2`} />
    </div>
  </div>
);

const getCategoryDescription = (cat) => {
  const map = {
    Salad: "Fresh, crisp greens tossed with seasonal vegetables and a light zesty dressing.",
    Salads: "Fresh, crisp greens tossed with seasonal vegetables and a light zesty dressing.",
    Sandwich: "Toasted artisanal bread layered with premium fillings and signature house sauces.",
    Sandwiches: "Toasted artisanal bread layered with premium fillings and signature house sauces.",
    Deserts: "Indulgent, handcrafted sweets perfect for satisfying your sugar cravings.",
    Desert: "Indulgent, handcrafted sweets perfect for satisfying your sugar cravings.",
    Pasta: "Al dente pasta served with rich, slow-simmered sauces and Italian herbs.",
    Rolls: "Golden, flaky wraps filled with savory spiced ingredients and fresh veggies.",
    Cake: "Decadent, oven-fresh cakes baked to perfection with rich cream frostings.",
    "Pure Veg": "Wholesome, farm-fresh vegetarian delights bursting with authentic natural flavors.",
    Noodles: "Wok-tossed noodles perfectly seasoned with our signature umami sauces.",
  };
  return map[cat] || "A delicious signature dish crafted with the finest ingredients by our chefs.";
};

// ── Feature 5: AI Recommendations strip ───────────────────────────────────────
const RecommendedStrip = ({ url, dark }) => {
  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!userId || !token || fetched) return;
    setLoading(true);
    setFetched(true);
    axios
      .get(`${url}/api/ai/recommend/${userId}`, { headers: { token } })
      .then((res) => {
        if (res.data.success && Array.isArray(res.data.data)) {
          setRecs(res.data.data.filter((r) => r.name));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, token, url]);

  if (!userId) return null;
  if (!loading && !recs.length) return null;

  return (
    <div className={`px-5 mb-8 ${dark ? "text-white" : "text-slate-800"}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🍽️</span>
        <h3 className={`text-lg font-bold ${dark ? "text-white" : "text-slate-800"}`}>
          Recommended for You
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dark ? "bg-brand-accent/20 text-brand-accent" : "bg-brand-accent/10 text-brand-accent"}`}>
          ✨ AI
        </span>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`shrink-0 w-52 rounded-xl p-4 border animate-pulse ${dark ? "bg-brand-card border-brand-border" : "bg-white border-slate-200"}`}>
              <div className={`h-3 rounded mb-2 ${dark ? "bg-brand-border" : "bg-slate-200"} w-3/4`} />
              <div className={`h-3 rounded ${dark ? "bg-brand-border" : "bg-slate-200"} w-1/2`} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {recs.map((rec, i) => (
            <div
              key={rec.foodId || i}
              className={`shrink-0 w-56 rounded-xl p-4 border transition-all duration-200 hover:-translate-y-1 ${dark ? "bg-brand-card border-brand-border hover:border-brand-accent/40" : "bg-white border-slate-200 hover:border-brand-accent/40 shadow-sm"}`}
            >
              <p className={`font-semibold text-sm mb-1 ${dark ? "text-white" : "text-slate-800"}`}>
                {rec.name}
              </p>
              {rec.price && (
                <p className="text-brand-accent font-bold text-sm mb-2">₹{rec.price}</p>
              )}
              <p className={`text-xs leading-relaxed ${dark ? "text-slate-400" : "text-slate-500"}`}>
                {rec.reason}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className={`mt-4 h-px ${dark ? "bg-brand-border" : "bg-slate-100"}`} />
    </div>
  );
};

// ── FoodDisplay ────────────────────────────────────────────────────────────────
const FoodDisplay = ({ category }) => {
  const { food_list, searchTerm, url } = useContext(StoreContext);
  const { theme } = useTheme();
  const dark = theme === "dark";

  const [priceRange, setPriceRange] = useState({ min: "", max: "" });

  // Feature 2: AI Search state
  const [aiSearchEnabled, setAiSearchEnabled] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState(null); // null = not searched yet
  const [aiSearching, setAiSearching] = useState(false);

  const runAiSearch = useCallback(async () => {
    const q = aiQuery.trim();
    if (!q) return;
    setAiSearching(true);
    try {
      const res = await axios.post(`${url}/api/ai/search`, { query: q });
      if (res.data.success) {
        setAiResults(res.data.ids || []);
      } else {
        setAiResults([]);
      }
    } catch {
      setAiResults([]);
    } finally {
      setAiSearching(false);
    }
  }, [aiQuery, url]);

  const clearAiSearch = () => {
    setAiQuery("");
    setAiResults(null);
  };

  const filteredItems = useMemo(() => {
    if (!food_list?.length) return [];

    // AI search mode: filter by returned IDs
    if (aiSearchEnabled && aiResults !== null) {
      return food_list.filter((item) => aiResults.includes(item._id || item.id));
    }

    return food_list.filter((item) => {
      const matchesCategory = category === "All" || category === item.category;
      const matchesSearch = item.name.toLowerCase().includes((searchTerm || "").toLowerCase());
      const min = Number(priceRange.min || 0);
      const max = Number(priceRange.max || Number.MAX_SAFE_INTEGER);
      const matchesPrice = item.price >= min && item.price <= max;
      return matchesCategory && matchesSearch && matchesPrice;
    });
  }, [food_list, category, searchTerm, priceRange.min, priceRange.max, aiSearchEnabled, aiResults]);

  const isLoading = food_list.length === 0;

  return (
    <section className={`py-10 transition-colors duration-300 ${dark ? "bg-brand-dark" : "bg-slate-50"}`} id="food-display">

      {/* Feature 5: AI Recommendations */}
      <RecommendedStrip url={url} dark={dark} />

      {/* Section header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between px-5 mb-6 gap-4">
        <div>
          <h2 className={`text-2xl font-extrabold tracking-tight ${dark ? "text-white" : "text-slate-800"}`}>
            Top Dishes Near You
          </h2>
          {!isLoading && (
            <p className={`text-sm mt-1 ${dark ? "text-brand-muted" : "text-slate-500"}`}>
              {filteredItems.length} {filteredItems.length === 1 ? "dish" : "dishes"} found
              {!aiSearchEnabled && category !== "All" && (
                <span className="ml-1">in <span className="text-brand-accent font-semibold">{category}</span></span>
              )}
              {aiSearchEnabled && aiResults !== null && (
                <span className="ml-1 text-brand-accent font-semibold">· AI search results</span>
              )}
            </p>
          )}
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Feature 2: AI Search toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setAiSearchEnabled(!aiSearchEnabled); clearAiSearch(); }}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200",
                aiSearchEnabled
                  ? "bg-brand-accent text-white border-brand-accent shadow-sm"
                  : dark
                    ? "border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-accent"
                    : "border-slate-200 text-slate-500 hover:border-brand-accent hover:text-brand-accent bg-white",
              ].join(" ")}
            >
              ✨ AI Search
            </button>
          </div>

          {/* Price range filter (hidden when AI search active) */}
          {!aiSearchEnabled && (
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${dark ? "border-brand-border bg-brand-card" : "border-brand-lightBorder bg-white"}`}>
              <span className={`text-xs font-semibold ${dark ? "text-brand-muted" : "text-slate-500"}`}>Price</span>
              <input
                type="number" min="0" placeholder="Min"
                value={priceRange.min}
                onChange={(e) => setPriceRange((p) => ({ ...p, min: e.target.value }))}
                className={`w-20 rounded-md px-2 py-1 text-xs outline-none ${dark ? "bg-brand-dark text-slate-100" : "bg-slate-100 text-slate-700"}`}
              />
              <span className={dark ? "text-brand-muted" : "text-slate-400"}>-</span>
              <input
                type="number" min="0" placeholder="Max"
                value={priceRange.max}
                onChange={(e) => setPriceRange((p) => ({ ...p, max: e.target.value }))}
                className={`w-20 rounded-md px-2 py-1 text-xs outline-none ${dark ? "bg-brand-dark text-slate-100" : "bg-slate-100 text-slate-700"}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Feature 2: AI Search input bar */}
      {aiSearchEnabled && (
        <div className="px-5 mb-6">
          <div className={`flex items-center gap-3 rounded-xl border p-3 ${dark ? "bg-brand-card border-brand-border" : "bg-white border-slate-200 shadow-sm"}`}>
            <span className="text-lg shrink-0">✨</span>
            <input
              type="text"
              placeholder='Try "something spicy under ₹200" or "light lunch with salad"…'
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAiSearch()}
              className={`flex-1 bg-transparent text-sm outline-none ${dark ? "text-white placeholder:text-brand-muted" : "text-slate-800 placeholder:text-slate-400"}`}
              autoFocus
            />
            {aiQuery && (
              <button onClick={clearAiSearch} className="text-brand-muted hover:text-white text-xs shrink-0">✕ Clear</button>
            )}
            <button
              onClick={runAiSearch}
              disabled={!aiQuery.trim() || aiSearching}
              className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg,#e94560,#f97316)" }}
            >
              {aiSearching ? "Searching…" : "Search"}
            </button>
          </div>
          {aiResults !== null && (
            <p className={`mt-2 text-xs ${dark ? "text-brand-muted" : "text-slate-400"}`}>
              {aiResults.length === 0
                ? "No dishes found for your search. Try a different query."
                : `Found ${filteredItems.length} dish${filteredItems.length !== 1 ? "es" : ""} matching your query.`}
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} dark={dark} />)
          : filteredItems.length === 0
            ? (
              <div className={`col-span-full flex flex-col items-center justify-center py-20 rounded-2xl border ${dark ? "bg-brand-card border-brand-border" : "bg-white border-brand-lightBorder"}`}>
                <span className="text-4xl mb-4">{aiSearchEnabled ? "🔍" : "🍽️"}</span>
                <p className={`text-lg font-semibold ${dark ? "text-white" : "text-slate-700"}`}>No dishes found</p>
                <p className={`text-sm mt-1 ${dark ? "text-brand-muted" : "text-slate-400"}`}>
                  {aiSearchEnabled ? "Try a different search query" : (searchTerm ? `No results for "${searchTerm}"` : `No items in ${category}`)}
                </p>
              </div>
            )
            : filteredItems.map((item) => (
              <FoodItem
                key={item._id}
                id={item._id}
                name={item.name}
                description={item.description || getCategoryDescription(item.category)}
                price={item.price}
                calorie={item.calorie}
                image={item.image}
                isAvailable={item.isAvailable}
              />
            ))
        }
      </div>
    </section>
  );
};

export default FoodDisplay;
