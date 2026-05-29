# Finance Tracker – Style Reference

A design system snapshot for reuse in future projects.

---

## Stack

| Concern | Library |
|---|---|
| CSS utility | Tailwind CSS (CDN, `darkMode: 'class'`) |
| Interactivity | Alpine.js 3.x |
| AJAX | HTMX 1.9.x |
| Charts | Chart.js 4.4.x |
| Backend templates | Jinja2 (FastAPI) |
| Font | System UI stack (`font-family: system-ui, sans-serif`) |

---

## Color Palette

### Brand / Primary
| Role | Hex | Tailwind |
|---|---|---|
| Primary blue | `#2563eb` | `blue-600` |
| Primary hover | `#1d4ed8` | `blue-700` |
| Primary light (bg) | `#dbeafe` | `blue-100` |
| Primary text (on light bg) | `#1d4ed8` | `blue-700` |

### Semantic
| Role | Hex | Tailwind |
|---|---|---|
| Positive / gain | `#16a34a` | `green-600` |
| Positive chart fill | `rgba(52,211,153,0.7)` | — |
| Negative / loss | `#dc2626` | `red-600` |
| Negative chart fill | `rgba(239,68,68,0.7)` | — |
| Warning | `#f59e0b` | `amber-400` |
| Warning text | `#92400e` | `amber-800` |

### Neutrals (light mode)
| Role | Hex | Tailwind |
|---|---|---|
| Page background | `#f9fafb` | `gray-50` |
| Card background | `#ffffff` | `white` |
| Card border | `#e5e7eb` | `gray-200` |
| Primary text | `#111827` | `gray-900` |
| Secondary text | `#374151` | `gray-700` |
| Muted text | `#6b7280` | `gray-500` |
| Very muted / labels | `#9ca3af` | `gray-400` |
| Table header bg | `#f9fafb` | `gray-50` |
| Table row divider | `#f3f4f6` | `gray-100` |
| Input border | `#d1d5db` | `gray-300` |

### Dark mode overrides
| Role | Light | Dark |
|---|---|---|
| Page background | `#f9fafb` | `#0f172a` (slate-950) |
| Card background | `#ffffff` | `#1e293b` (slate-800) |
| Card border | `#e5e7eb` | `#334155` (slate-700) |
| Nav background | `#ffffff` | `#1e293b` |
| Nav border | `#e5e7eb` | `#334155` |
| Primary text | `#111827` | `#f1f5f9` |
| Secondary text | `#374151` | `#e2e8f0` |
| Muted text | `#6b7280` | `#94a3b8` |
| Input background | `#ffffff` | `#162032` |
| Input border | `#d1d5db` | `#475569` |
| Table header bg | `#f9fafb` | `#162032` |
| Table row divider | `#f3f4f6` | `#1e2d45` |

Dark mode is toggled by adding the `dark` class to `<html>`. Persisted in `localStorage`.

---

## Chart Colors
```js
const COLORS = {
  netWorth:   '#2563eb',        // blue-600
  netWorthEx: '#93c5fd',        // blue-300 (dashed secondary)
  cash:       '#10b981',        // emerald-500
  debt:       '#ef4444',        // red-500
  stInvest:   '#8b5cf6',        // violet-500
  ltInvest:   '#f59e0b',        // amber-400
  realEstate: '#f97316',        // orange-500
  gain:       '#34d399',        // emerald-400
};
```

---

## Typography

| Element | Size | Weight | Color |
|---|---|---|---|
| Page / card title | `text-lg` / `font-semibold` | 600 | `gray-900` |
| Section heading | `font-semibold` | 600 | `gray-800` |
| KPI number | `text-2xl font-bold` | 700 | `gray-900` or semantic |
| Large KPI number | `text-xl font-bold` | 700 | `gray-900` |
| Body / table data | `text-sm` / 0.875rem | 400 | `gray-900` / `gray-700` |
| Labels / captions | `text-xs` / 0.75rem | 400 | `gray-500` |
| Uppercase micro-label | `text-xs uppercase tracking-wide` | 400 | `gray-500` |

---

## Components

### Card
```css
.card {
  background: white;
  border-radius: 0.75rem;   /* rounded-xl */
  border: 1px solid #e5e7eb;
  padding: 1.25rem;          /* p-5 */
}
```
Dark mode: background `#1e293b`, border `#334155`.

### Navigation Bar
- Sticky, `h-14`, `bg-white`, `border-b border-gray-200`
- Max-width `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Logo: `text-lg font-semibold text-gray-900`
- Nav links: `text-sm`, color `gray-600`, active state is `blue-600` with a 2px bottom border

### Buttons
| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| Primary | `#2563eb` | white | none | `#1d4ed8` |
| Secondary | white | `#374151` | `#d1d5db` | `#f9fafb` |
| Danger | white | `#dc2626` | `#fca5a5` | `#fee2e2` |

Border-radius: `0.5rem` (primary/secondary), `0.375rem` (danger).  
Padding: `0.5rem 1.25rem` (default), `0.25rem 0.625rem` (small, `.btn-sm`).

### Pill / Tab Filter
```html
<!-- active -->
<button class="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium">All</button>
<!-- inactive -->
<button class="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-1.5 rounded-full text-sm font-medium">Me</button>
```

### Segmented Control (within a pill tray)
```html
<div class="flex gap-1 bg-gray-100 rounded-lg p-1 text-xs">
  <button class="bg-white shadow text-gray-900 px-2 py-1 rounded-md font-medium">Active</button>
  <button class="text-gray-500 px-2 py-1 rounded-md font-medium">Inactive</button>
</div>
```

### Data Table
```css
.data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { padding: 0.625rem 0.75rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb;
     font-weight: 500; color: #374151; white-space: nowrap; }
td { padding: 0.625rem 0.75rem; border-bottom: 1px solid #f3f4f6; color: #111827; }
tr:hover td { background: #f9fafb; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
```

### Form Inputs
```css
.input-field {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.875rem;
  outline: none;
}
/* focus */
border-color: #2563eb;
box-shadow: 0 0 0 2px #bfdbfe;
```

### Delta / Change Indicators
```css
.delta-pos { color: #16a34a; }  /* ▲ positive */
.delta-neg { color: #dc2626; }  /* ▼ negative */
```
Text size: `text-xs`. Prefix with `▲` or `▼`.

### Owner / Type Badges
Small pill labels used on accounts and assets.
```css
.badge-me      { background:#dbeafe; color:#1d4ed8; }  /* blue   */
.badge-partner { background:#fce7f3; color:#be185d; }  /* pink   */
.badge-joint   { background:#d1fae5; color:#065f46; }  /* green  */
.badge-debt    { background:#fee2e2; color:#991b1b; }  /* red    */
.badge-lt      { background:#fef3c7; color:#92400e; }  /* amber  */
.badge-re      { background:#f3f4f6; color:#374151; }  /* gray   */
```

---

## Layout

- **Max content width:** `max-w-7xl` (1280px)
- **Horizontal padding:** `px-4 sm:px-6 lg:px-8`
- **Section gap:** `mb-5` between major sections, `mb-4` between cards
- **Card grid (summary KPIs):** `grid grid-cols-2 lg:grid-cols-5 gap-3`
- **Card grid (metrics):** `grid grid-cols-2 lg:grid-cols-4 gap-3`

---

## Responsive Charts

Charts use Chart.js 4 with `responsive: true` and `maintainAspectRatio: false`.  
Canvas elements live inside a `.chart-wrap` div that controls height via CSS:

```css
.chart-wrap     { position: relative; height: 300px; }
.chart-wrap--sm { position: relative; height: 240px; }
@media (max-width: 640px) {
  .chart-wrap     { height: 220px; }
  .chart-wrap--sm { height: 180px; }
}
```

---

## Privacy Mode

Toggled by adding `privacy-mode` to `<html>`. Persisted in `localStorage`.

```css
html.privacy-mode .private,
html.privacy-mode .num,
html.privacy-mode .delta-pos,
html.privacy-mode .delta-neg {
  filter: blur(6px);
  user-select: none;
  transition: filter 0.25s;
}
html.privacy-mode #gainHeatmap { filter: blur(8px); }
```

---

## Micro-interactions

- All transitions: `0.15s ease` for colors/backgrounds
- Nav links: `border-bottom` underline animates on `.active`
- Segmented controls: `bg-white shadow` active state, `transition-all`
- Card hover rows: `background: #f9fafb`
- Buttons: `cursor: pointer`, color shift on hover

---

## Gain / Loss Heatmap

CSS Grid layout (13 cols: year label + 12 months).  
Cell colors use `rgba()` with intensity-scaled alpha (`0.12–0.94` light, `0.28–0.88` dark):

```
Green gain:  rgba(16, 185, 129, α)   /* emerald-500 */
Red loss:    rgba(239, 68, 68, α)    /* red-500     */
No data:     #f3f4f6 (light) / #1e2d45 (dark)
```
