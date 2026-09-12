# Foundation and compatibility

Use a pnpm workspace with a Next.js browser client, Express 5 modular monolith, and PostgreSQL 18. Next proxies `/api/*` to Express; only Express accesses the database. Better Auth owns account/session tables. Domain tables carry user ownership and services validate linked ownership.

Official generator: Next.js 16.3.5, React 19.2.8. Drizzle stable 0.45.2/Kit 0.31.10 and Better Auth 1.7.4. TypeScript 6.0.2 selected because the current typescript-eslint peer range excludes TypeScript 7. ESLint 9.39.5 is retained because the current Next.js React/accessibility plugins do not yet support ESLint 10; its deprecation is a known tooling limitation. pnpm 9.15.9 is pinned to the installed workspace tool. Lockfile captures exact resolutions.

No remote fonts: system typography keeps builds/local use independent of font-service availability. Local development cookies are HttpOnly/SameSite=Lax; production requires HTTPS and Secure cookies. Application writes require the configured Origin, and Better Auth retains its own CSRF checks. No cross-origin browser API is enabled.

References checked during scaffold: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Better Auth Express](https://better-auth.com/docs/integrations/express), [Drizzle migrations](https://orm.drizzle.team/docs/migrations).
