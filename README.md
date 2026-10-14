# Conx Ops

AMC contracts, clients, service tickets and service reports (PDF) for Conx Systems. Plain HTML/JS hosted on GitHub Pages, data in Supabase, synced live across devices.

## Setup (about 15 minutes)

1. **Supabase project.** Create a free project at supabase.com.
2. **Database.** Supabase > SQL Editor > New query. Paste all of `supabase/schema.sql` and Run.
3. **Team logins.** Supabase > Authentication > Users > Add user (email + password) for yourself and Anup. Then Authentication > Sign In / Providers > Email and turn **off** "Allow new users to sign up", so only people you add can get in.
4. **Connect the app.** Supabase > Project Settings > API. Copy the Project URL and the `anon` public key into `config.js`.
5. **GitHub Pages.** Create a GitHub repository (private is fine on paid plans; Pages on free plans needs a public repo, which is OK because the data is protected by login). Upload these files, then Settings > Pages > Deploy from branch > `main` / root. Open the URL it gives you.
   On iPad Safari: Share > Add to Home Screen.
6. **Optional: Rewrite with AI (free).** Get a free key from Google AI Studio (aistudio.google.com, "Get API key"), or from console.groq.com. Install the Supabase CLI, then:
   ```
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase secrets set GEMINI_API_KEY=your-key
   supabase functions deploy rewrite
   ```
   For Groq instead: `supabase secrets set AI_PROVIDER=groq GROQ_API_KEY=your-key`. Then set `rewriteFunction: true` in `config.js`.
   Free tiers have daily limits (plenty for report notes), and free-tier prompts may be used by the provider to improve their models, so keep client-sensitive details out of the rough notes.

## Move your existing data

Old app: Data > Download full backup (.json). New app: sign in > Data > Import > Merge. Report numbers continue from the highest existing number.

## Notes
- The app needs internet; changes made offline are not saved.
- Turn on Supabase's daily backups (paid plans) or use Data > Download full backup regularly.
- Everyone with a login can see and edit everything.

## Monthly email backup (optional, free)

Emails a full backup (.json, restorable from Data > Import) and a reports sheet (.csv) on the 1st of every month, to the address you set in the app (Data > Monthly email backup).

1. **Email sender.** Create a free account at resend.com and make an API key. Note: without a verified domain, Resend only delivers to the email you signed up with, so use that same address as the backup address (or verify conxsystems.in in Resend to send to anyone).
2. **Database.** Open `supabase/monthly-backup.sql`, replace the three `<<...>>` placeholders (project ref, anon key, and a long random password of your choice), paste into Supabase > SQL Editor and Run.
3. **Function.** In a terminal in this folder:
   ```
   supabase secrets set RESEND_API_KEY=re_xxx CRON_SECRET=the-same-random-password
   supabase functions deploy monthly-backup
   ```
4. **Address.** In the app: Data > Monthly email backup > type the email > Save email, then tap **Send a backup now** to test.
