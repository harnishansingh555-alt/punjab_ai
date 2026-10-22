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
