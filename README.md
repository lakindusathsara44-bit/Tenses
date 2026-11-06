# English Tenses — Interactive Sinhala Learning Guide

A responsive, self-contained learning website covering all 12 English tenses.

## Features
- All 12 tenses grouped into Present, Past and Future.
- Affirmative, negative, question and negative-question structures.
- Six example sentences per tense, each with a Sinhala meaning.
- Interactive Active → Passive reveal with a JavaScript animation.
- Notes for tenses where passive voice is uncommon or unnatural.
- Searchable tense navigation, responsive layout and quick practice quiz.
- White, light-blue and blue visual theme.
- Respects the user's reduced-motion accessibility preference.\n- Dedicated `activities.html` subpage with 12 tense-specific activity tasks.\n- Automatic marking, percentage scores and an automatically generated grade rubric (A/B/C/S/W).\n- Automatic progress tracking and animated charts for tense knowledge and grammar skills.\n- Saves the latest submitted results in the current browser using localStorage (no account/server sync).

## Run locally
Open `index.html` in a modern browser. No build tools or dependencies are required.

## Publish with GitHub Pages
1. Open the repository **Settings → Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select **main** and **/(root)**, then save.
4. Wait for GitHub Pages to publish the site.

## Grammar note
Passive voice requires a transitive verb and an object that can become the subject. Some perfect continuous passive forms are technically possible in limited contexts but are extremely uncommon or awkward; the guide labels these rather than presenting them as everyday English.

## Daily science and nature articles

The `DailyArticles.html` page displays one AI-generated educational article per day about animals, plants and trees, dinosaurs, or microorganisms.

### Enable automatic publishing

1. Create an OpenAI API key in your OpenAI Platform account.
2. In this repository, open **Settings → Secrets and variables → Actions**.
3. Select **New repository secret**. Name it `OPENAI_API_KEY` and paste the API key as the secret value.
4. Merge the daily article publishing workflow into the repository's default branch.
5. Open **Actions → Daily Educational Articles → Run workflow** to test the first article manually.

The scheduled workflow runs at **06:00 Asia/Colombo** every day. It uses the OpenAI Responses API and the `gpt-5-mini` model by default. API usage is billed separately from a ChatGPT subscription. The workflow stores article JSON files in `articles/` and updates `articles/index.json`; GitHub Pages then serves the updated content.

To select a different supported API model, add a repository Actions variable named `OPENAI_MODEL`. The default is `gpt-5-mini`.

The generator checks the Sri Lankan calendar date before publishing, so a manual rerun on a day that already has an article will not create a duplicate.
