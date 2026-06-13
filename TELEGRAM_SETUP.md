# Telegram Bot Setup

The bot lets you post photos, videos, and text updates from your phone directly to the travel feed on the web app.

## 1. Create a bot with BotFather

1. Open Telegram and search for **@BotFather** (blue checkmark)
2. Send `/start`, then `/newbot`
3. Choose a display name and a username (must end in `bot`, e.g. `saraocherasmus_bot`)
4. Copy the token BotFather gives you — it looks like `123456789:ABCdef...`

To reuse an existing bot: send `/mybots` to BotFather → select the bot → **API Token**.

## 2. Configure the server

Create `server/.env`:

```env
PORT=3001
CLIENT_URL=http://localhost:5173
TELEGRAM_BOT_TOKEN=your_token_here
```

## 3. Start the server

```bash
cd server && npm run dev
```

You should see:
```
✅ Telegram bot initialized successfully
🚀 Telegram bot polling started
```

## 4. Using the bot

Find your bot by username in Telegram and send `/start`. From then on:

| What you send | What happens |
|---|---|
| 📸 Photo (with optional caption) | Saved as a photo post in the feed |
| 🎥 Video (with optional caption) | Saved as a video post in the feed |
| 💬 Text message | Saved as a text post in the feed |
| 📍 Location | Saved as a location post with coordinates |

Posts appear in the **Reseflöde** (travel feed) section of the web app as an Instagram-style grid. Click any post to see the full image/video, caption, timestamp, and coordinates.

## 5. Security notes

- Keep the bot token out of version control — `server/.env` is in `.gitignore`
- The bot uses polling (not webhooks), so no public URL or port forwarding is needed
- The feed API requires an API key — the same one used for the rest of the app
