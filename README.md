# Demo Night App 🧬

**The [Demo Night App (DNA)](https://demos.aicollective.com) is an open-source, community-led project we use to maximize value for all involved at our flagship demo night events!**

![App Screenshots](./assets/App.png)

<a href="https://www.loom.com/share/20bb08ab431040cf878a8a654860efab">
  <img src="https://cdn.loom.com/sessions/thumbnails/20bb08ab431040cf878a8a654860efab-29f338a04a89eb3c-full-play.gif">
</a>

## 🚀 What is Demo Night?

_An evening of live demos and collaboration with the innovators shaping tomorrow_. Here's an [example event](https://lu.ma/demo-night)!

## 🧑‍💻 Contributing

If you'd like to contribute to this community project, check out our [issues](https://github.com/the-ai-collective/demo-night-app/issues) to find tasks you can help with!

Feel free to reach out to us at [engineering@aicollective.com](mailto:engineering@aicollective.com)! 😄

## ⚙️ Getting Started

### 1. Install the packages

```bash
yarn install
yarn global add dotenv-cli
```

### 2. Set up environment variables

For `.env` key/value pairs, see `.env.example`.

### 3. Start the local DB Docker Compose service

```bash
./start-database.sh
```

### 4. Push the schema and seed the local DB with a "<test@example.com>" example account and test event

```bash
yarn db:push
yarn db:seed
```

### 5. Start the development server

```bash
yarn dev
```

- The local app should now be available at `localhost:3000` and `localhost:3000/admin`!
- You can log in with "<test@example.com>"

## 📊 Data Ops

### Dev Data Studio

To manipulate the data and relations directly via Prisma during local development:

```bash
yarn db:studio
```

### Migration

To alter the data schema (adding/removing/editing columns, changing unique/compound/primary keys, etc.), make changes in `schema.prisma` file, save, and run:

```bash
yarn db:migrate
```

- Fixing failed migrations:
  <https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing>

## 🚢 Production releases

Production at [demo-night.tk.sg](https://demo-night.tk.sg) ships when you **push a version tag**. Merging a pull request into `main` does not go live on its own, and you should not need `./deploy.sh` for a normal release.

### 1. Land the work, then tag it

Either merge the pull request into `main` and tag that commit, or tag a commit on a branch. If the tag is not already on `main`, the release workflow merges it in.

```bash
git checkout main
git pull
git tag v2026.08.19
git push origin v2026.08.19
```

Use `vYYYY.MM.DD`. If you ship more than once on the same day, add a suffix (`v2026.08.19.1`), matching other Tinkertanker apps.

You can also create the tag in the GitHub UI (**Releases → Draft a new release**, or **Code → Tags**).

### 2. What the workflow does

Pushing `v*` runs [`.github/workflows/release.yml`](.github/workflows/release.yml):

1. **Merge tag into `main`** if that commit is not already there (fast-forward when possible).
2. Point the `production` branch at the tagged commit (this is what is live).
3. SSH to `dev.tk.sg`, check out that tag in `Docker/demo-night-app`, and rebuild the Compose stack.

To redeploy an existing tag without creating a new one, use **Actions → Release → Run workflow**.

### 3. One-time GitHub secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret | Required | Default |
| --- | --- | --- |
| `SSH_PRIVATE_KEY` | yes | — (private key trusted by `tinkertanker@dev.tk.sg`) |
| `SSH_HOST` | no | `dev.tk.sg` |
| `SSH_USER` | no | `tinkertanker` |
| `DEPLOY_PATH` | no | `Docker/demo-night-app` |

The server still keeps `.env.production` locally; it is not in git. Create it from `.env.production.example` on first setup.

`./deploy.sh` remains a laptop fallback if GitHub Actions cannot reach the host.
