# Punjab AI | ਪੰਜਾਬ AI

A bilingual (English and Punjabi) AI chatbot website.

## Run it
1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env` and add your API key (Google Gemini or Claude).
3. `npm install`
4. `npm start`
5. Open http://localhost:3000 (home page). The chat is at http://localhost:3000/chat.html

## Google sign-in
Already set up. The Client ID is built into `server.js` and `.env.example`, so there is nothing to paste.
One thing in Google Cloud Console (Credentials, your OAuth client): under **Authorized JavaScript origins** add `http://localhost:3000` (and your real https address when you publish).

How it works: the browser gets a Google ID token, the server verifies it with `google-auth-library`, then sets a signed, HttpOnly session cookie (30 days). Chat history is saved in the browser, one chat per Google account.

## Your AI key (enter it only once)
Put it on the `AI_API_KEY=` line in `.env`. It is also saved in your home folder (`.punjab-ai/config.json`), so a new copy of this project or a re-unzip will not ask for it again.

## Voice
The chat page has a Speak button (voice input) and a Voice replies switch (reads answers aloud). Voice input needs Chrome or Edge. Reading Punjabi aloud needs a Punjabi voice installed on the device.

## Windows shortcut
Double-click `start.bat`. It installs what is needed, starts the server and opens the site. 

## Structure
- `server.js`   Express backend, calls the Anthropic API (key stays on the server)
- `public/`     Website: index.html (home), chat.html (chat), shared style.css and auth.js (Google sign-in)

## Speed
Answers now stream in word by word. The server remembers which AI model and address work, skips a provider that just failed, and compresses pages. Run `npm install` once after unzipping (a new package, `compression`, was added).

## Pages
index (home), chat, features, help, about, faq, contact, privacy, terms, live, plus a 404 page. The English and Punjabi text on each page is switched with the language button.

## Important
Do not double-click the HTML files. Always start the server (`npm start`) and open http://localhost:3000, otherwise the chat cannot reach the AI.

## If the chat does not answer
If the key is wrong or missing, put a new key on the `AI_API_KEY=` line in `.env`. You can also open http://localhost:3000/api/test. It says WORKING, or tells you what to fix (wrong key, no credit, wrong model name). Keep the server window open and restart it after changing `.env`.

## Attach files and create images (chat page)
- The paperclip button attaches up to 4 files: pictures, a PDF, or text files (txt, md, csv, json, code). You can also paste a picture or drag files onto the page.
- Text files are read by every AI provider. Pictures and PDFs are read by Google Gemini (or Claude), so set `GEMINI_API_KEY` (or an AI_API_KEY that is a Gemini key) in Render > Environment.
- The golden picture button turns on image mode: type what you want to see and it is made with AI Horde. You can still type `/image your description` too.

## New chat design (sidebar, dark/light, sign-in required)
- Left: your old chats and a New chat button. Middle: the chat. Bottom: file attach, image create, voice and send. The moon/sun button switches theme. English and Punjabi both work.
- Chat and image creation need Google sign-in, and the server refuses requests without it.
- Render > Environment needs: `GOOGLE_CLIENT_ID`, `SESSION_SECRET` (any long random text), `HORDE_API_KEY` (aihorde.net), `GEMINI_API_KEY` (reads pictures and PDFs). Optional: `GROQ_API_KEY` + `CHAT_PROVIDER=groq` for faster chat.
- AI Horde is free but community-run, so a chat answer can take 10 to 60 seconds. Pictures and PDFs always go to Gemini.

## Gemini-style chat (latest update)
- New look: big gradient greeting, suggestion cards, a rounded message box, and answers shown as clean text (no bubble) with a small Punjab AI logo.
- Answers are formatted: headings, bold, lists, tables, quotes, links and code blocks with a Copy button.
- Under every answer: Copy, Good, Bad, Read aloud and Write again (on the newest answer).
- The send arrow turns into a Stop square while an answer is being written. Stopping keeps what was already written.
- The page only follows the answer while you are at the bottom. A down arrow appears when you scroll up.
- The AI now has a stronger instruction prompt (direct answers, good structure, honest about uncertainty, natural Punjabi) and knows today's date.
- Provider order is now Claude, then Gemini, then Groq, and AI Horde last. Whichever keys you set are used. Set `CHAT_PROVIDER=gemini` to force a first choice. Claude now streams word by word too.

## Professional site design and faster AI (latest update)
- Home page and all content pages restyled: clean white sticky header, soft gold glow hero, chat-window preview, bordered cards, dark "How it works" band, and a tidy footer.
- Speed: Gemini now answers first, then Groq, Claude and AI Horde. If a provider shows no first word within 7 seconds the server switches to the next one at once (change with `FIRST_WORD_MS` in .env). A provider that failed is skipped for a while. Only the last 16 messages are sent, which makes each request lighter.

## Email login, Google login and free API keys (latest update)
- `login.html` is the first page for visitors who are not signed in. They can type an email and get a 6-digit code (sent with Resend), or tap the Google button. Chat sends signed-out visitors here too.
- `api-key.html` gives every signed-in person one free API key (shown once, only a hash is stored). The key works on `POST /api/v1/chat` with `Authorization: Bearer pai_...` and `{"prompt":"..."}`. Default limit: 50 requests per day (`API_DAILY_LIMIT`).
- Render > Environment: add `RESEND_API_KEY`. Resend only lets `onboarding@resend.dev` mail the Resend account owner, so to email everyone verify `Punjab-ai.website` at resend.com/domains and set `RESEND_FROM=Punjab AI <login@punjab-ai.website>`.
- API keys are saved in a file. Render's free disk is wiped on every deploy, so attach a Render Disk and set `DATA_DIR` to its path if you want keys to survive.
- To show the home page to everyone instead of the login page, set `LOGIN_FIRST=false`.

## Profile page and image API (latest update)
- `profile.html`: name (editable), email, sign-in method, member-since date, language and light/dark theme, a summary of the API key and today's usage, sign out, and "Delete my data" (removes the saved name and API key from the server). Open it from the name in the home page or the Profile link in the chat sidebar.
- The same free API key now covers chat and images: `POST /api/v1/chat` and `POST /api/v1/image` with `{"prompt":"..."}`. Limits per key per day: `API_DAILY_LIMIT` (default 50 chats) and `API_IMAGE_DAILY_LIMIT` (default 10 pictures). A picture can take 10 to 60 seconds. A picture that fails is not counted.
- Profiles and API keys are saved in `DATA_DIR` (see above). The site description now says Punjab AI also creates images and provides an API key.
