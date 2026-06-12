# Salescode.ai · Incentive Engine

A web app for designing, cloning, and analyzing sales incentive programs — KPIs,
payout matrices, gate rules, ROI and performance analytics in one place.

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- **React Router** for navigation
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **TanStack Query** for data/cache
- **Recharts** for charts, **xlsx** for report exports
- **Vitest** + **Testing Library** for tests

## Getting started

```bash
npm install
npm run dev      # start the dev server on http://localhost:8080
```

## Scripts

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Start the Vite dev server                    |
| `npm run build`      | Production build to `dist/`                  |
| `npm run build:dev`  | Build in development mode                    |
| `npm run preview`    | Preview the production build locally         |
| `npm run lint`       | Run ESLint                                   |
| `npm run test`       | Run the test suite once                      |
| `npm run test:watch` | Run tests in watch mode                      |

## Project structure

```
src/
  components/    UI building blocks (ui/ = shadcn primitives), wizard, clone, layout, tour
  pages/         Route-level pages (Programs, Reports, Analytics, KPI Library, Users…)
  routes/        React Router route adapters wiring pages to URLs
  lib/           Stores and domain helpers (programStore, reportFields, sfaTargets…)
  data/          Mock/demo data
  hooks/         Reusable hooks
  types/         Shared TypeScript types
```

## Routing

Navigation is handled by React Router. Key routes:

| Path                         | Page                  |
| ---------------------------- | --------------------- |
| `/programs`                  | Programs list (home)  |
| `/programs/:id/analytics`    | Program analytics     |
| `/create`                    | Create-program hub    |
| `/create/wizard`             | Incentive wizard      |
| `/clone/quick-review`        | Quick clone review    |
| `/kpi-library`               | KPI library           |
| `/reports`                   | Reports               |
| `/users`                     | Users list            |
| `/analytics/performance`     | Performance dashboard |
| `/analytics/roi`             | ROI analysis          |
