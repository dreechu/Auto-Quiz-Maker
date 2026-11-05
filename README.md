# Recall

Recall turns class notes, slides, PDFs, and images into private, user-owned flashcard decks.

## Run locally

1. Install dependencies with `npm install`.
2. Set the Firebase web app values in `.env.local`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
3. Set `GEMINI_API_KEY` for server-side flashcard generation with Gemini 3.8 Flash.
4. Enable Google and Email/Password providers in Firebase Authentication.
5. Set the server-only Firebase Admin credentials `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_PROJECT_ID`. `FIREBASE_DATABASE_URL` may be set explicitly; otherwise the configured Firebase web app database URL is used.
6. Set `ADMIN_EMAILS` to a comma-separated list of trusted administrator email addresses, or `ADMIN_UIDS` to trusted Firebase Auth UIDs. Keep these values server-only. Matching accounts receive the admin role when their profile is synced.
7. Apply [database.rules.json](./database.rules.json) to your Firebase Realtime Database. Client-side writes to account profiles, notes, and decks are disabled; authenticated server routes use Firebase Admin to enforce quotas and apply writes.
8. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Study workflow

- Sign up or sign in with Google or email and password.
- Upload a PDF, DOCX, PPTX, TXT, MD, PNG, JPG, or WEBP file—or paste raw notes—to create a deck.
- Open `/notes` from the navigation to turn a PDF, photo, DOCX, PPTX, TXT, or Markdown file into detailed, sectioned AI notes with key takeaways and terms. Notes are private by default and can be searched, renamed, reopened, deleted, copied, or downloaded. Publish a note to list it in `/discover` and share its public reader link; making it private disables the link and removes it from Discover. Source uploads are processed temporarily and aren’t saved.
- Import an Anki `.apkg` package directly. Imported cards are previewed for editing before saving; the package is parsed in memory and isn’t retained.
- Choose any positive whole-number card count, study style, and difficulty. Large requests are generated in batches, and the review editor shows five cards per page.
- Study with keyboard shortcuts, shuffle, filter unfinished or due cards, and rate each review Again, Hard, Good, or Easy to schedule the next review.
- Add comma-separated topic tags in the deck editor, then search and filter the dashboard by topic, card format, and study status. The dashboard also shows due cards, streaks, seven-day accuracy, and cards that need more practice.
- Delete a deck from the dashboard when it is no longer needed.
- Manage roles and plans from `/admin` using a bootstrap administrator account.
- Make a deck public from your dashboard to copy a share link and list it in `/discover`. Public decks display their questions, answers, and hints; switch sharing off at any time to remove a deck from Discover and disable its link.

Flashcard uploads are read in memory and sent directly to `/api/generate-flashcards`. Images are resized in the browser; PDFs and images are passed to Gemini as inline data, while DOCX/PPTX/TXT/MD text is extracted in the browser. The `/notes` workflow accepts files up to 200 MB; PDF and photo uploads are deleted from Gemini after processing, and DOCX/PPTX/TXT/MD files are extracted temporarily by the server. Original files are not saved to the account or written to local disk or app-managed object storage. Flashcards and deck metadata are stored under `decks/{uid}`, saved notes under `notes/{uid}`, and private daily review counts under `users/{uid}/studyDays` in Realtime Database.

The generation route requires a verified Firebase ID token, enforces monthly plan limits, and uses the Gemini API key only on the server. Free includes 3 decks and 10 monthly generations; Pro includes 50 decks and 500 monthly generations; Unlimited has no quota. Generation counts reset at the start of each UTC calendar month. Plans are assigned by an administrator; payment checkout is not connected.

Keep all Firebase Admin credentials, administrator allowlists, and `GEMINI_API_KEY` server-only. Only the Firebase web app settings use the `NEXT_PUBLIC_` prefix.
