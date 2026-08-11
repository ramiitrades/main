# Trader Edge

A real, database-backed version of the Trader Edge trading journal — Next.js + Supabase.

## What's in here

- **Auth**: real email/password accounts via Supabase Auth (`app/login`, `app/signup`)
- **Database**: `supabase/schema.sql` — run this once in your Supabase project to create the tables
  (`accounts`, `trades`, `playbooks`, `certificates`, `expenses`, `review_notes`) with Row Level
  Security so each trader only ever sees their own data
- **Dashboard**: `app/dashboard/page.js` — logs trades and computes stats from real Supabase data
- `middleware.js` protects `/dashboard` — logged-out visitors get redirected to `/login`

This is a starting scaffold, not the full feature set of the prototype — it covers accounts, auth,
and the core trade log/dashboard. The same pattern (a Supabase query per page) extends to Journal,
Playbook, Breakdown, Certificates, and Expenses when you're ready to add them.

## 1. Set up Supabase

1. In your Supabase project, open the **SQL Editor** and paste in the contents of
   `supabase/schema.sql`, then click **Run**. This creates every table and security policy.
2. Go to **Settings → API** and copy your **Project URL** and **Publishable key**.

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Paste your Project URL and Publishable key into `.env.local`.

## 3. Install and run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/login`. Click through to sign up, and you're using
the real app.

## 4. Deploy

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), import that repo.
3. In the Vercel project's **Environment Variables** settings, add the same two variables from
   your `.env.local`.
4. Deploy. Vercel gives you a live URL immediately; add your own domain under
   **Settings → Domains** whenever you're ready.

## Notes on Supabase Auth email confirmation

By default, Supabase requires users to confirm their email before they get a session. For faster
testing, you can turn this off in **Authentication → Providers → Email → Confirm email** (toggle
off) — just remember to turn it back on before real users sign up, so people can't register with
emails they don't own.
