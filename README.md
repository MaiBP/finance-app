This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Telegram Integration (MVP)

### What is included

- `POST /api/telegram/webhook`: receives Telegram messages, links chat, and creates incomes/expenses.
- `POST /api/telegram/link-code`: generates a one-time link code for the logged-in user.
- Profile page now has a Telegram section to generate/copy a link code.

### Required environment variables

Add to `.env.local`:

```bash
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...

FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n\"
```

### Setup steps for testing

1. Install dependencies:
```bash
npm install
```

2. Run app:
```bash
npm run dev
```

3. Expose local app with HTTPS (example using ngrok):
```bash
ngrok http 3000
```

4. Register webhook in Telegram:
```bash
curl -X POST \"https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook\" \\
  -d \"url=https://<YOUR_HTTPS_HOST>/api/telegram/webhook\" \\
  -d \"secret_token=<TELEGRAM_WEBHOOK_SECRET>\"
```

5. In your app -> `Perfil`:
- click `Generar código`
- copy the generated code

6. In Telegram chat with your bot:
- send `/start`
- send `/vincular CODIGO`

7. Test commands:
- `gaste 200 en comida`
- `ingrese 1500 en salario`

Then verify records in `Gastos`, `Ingresos` and `Análisis`.
