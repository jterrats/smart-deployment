---
title: Home
description: Smart Deployment orchestrates Salesforce metadata deployments with dependency analysis, wave generation, and optional AI assistance.
permalink: /
---

<section class="hero">
  <span class="eyebrow">Salesforce CLI Plugin</span>
  <h1>Dependency-aware deployment orchestration for Salesforce metadata.</h1>
  <p>
    Smart Deployment scans metadata, builds a dependency graph, generates staged deployment waves,
    validates project state, and supports optional AI-assisted prioritization and dependency inference.
  </p>

  <div class="badges">
    <img src="https://img.shields.io/github/actions/workflow/status/jterrats/smart-deployment/test.yml?branch=main&label=CI&logo=github" alt="CI status" />
    <img src="https://img.shields.io/github/license/jterrats/smart-deployment" alt="License" />
    <img src="https://img.shields.io/github/v/release/jterrats/smart-deployment?display_name=tag&label=latest%20release" alt="Latest release" />
    <img src="https://img.shields.io/node/v/smart-deployment?logo=node.js" alt="Node version" />
    <img src="https://img.shields.io/npm/v/smart-deployment?logo=npm&label=npm" alt="npm version" />
  </div>

  <div class="hero-actions">
    <a class="button button--primary" href="{{ site.baseurl }}/commands/">Explore Commands</a>
    <a class="button button--secondary" href="https://github.com/{{ site.repository }}" target="_blank" rel="noopener">View Repository</a>
  </div>
</section>

<section class="grid">
  <article class="panel span-4">
    <h2>Analyze</h2>
    <p>Scan a Salesforce project, build a dependency graph, detect cycles, and generate deployment waves.</p>
    <pre><code>sf smart-deployment analyze \
  --source-path force-app \
  --use-ai</code></pre>
  </article>

  <article class="panel span-4">
    <h2>Validate</h2>
    <p>Check deployment readiness, summarize issues, and optionally add AI-assisted risk assessment.</p>
    <pre><code>sf smart-deployment validate \
  --source-path force-app \
  --use-ai</code></pre>
  </article>

  <article class="panel span-4">
    <h2>Deploy</h2>
    <p>Run staged deployments, persist local state, and support conservative remediation for supported cycles.</p>
    <pre><code>sf smart-deployment start \
  --source-path force-app \
  --target-org myorg</code></pre>
  </article>
</section>

<section class="grid">
  <article class="panel span-6">
    <h2>What It Covers Today</h2>
    <ul>
      <li>Dependency graph generation and staged wave construction</li>
      <li>Cycle detection and conservative remediation for supported ApexClass cycles</li>
      <li>CLI flows for <code>analyze</code>, <code>start</code>, <code>validate</code>, <code>status</code>, <code>resume</code>, and <code>config</code></li>
      <li>JSON and HTML analysis reports</li>
      <li>Optional AI assistance through shared provider adapters</li>
    </ul>
  </article>

  <article class="panel span-6">
    <h2>Current AI Surface</h2>
    <p>
      The current provider abstraction supports <code>agentforce</code> and <code>openai</code>.
      AI can assist with dependency inference, priority weighting, and validation, while retaining
      deterministic fallbacks where possible.
    </p>
    <pre><code>{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "timeout": 30000
  }
}</code></pre>
  </article>
</section>

<section class="grid">
  <article class="panel span-4">
    <h2>6 Commands</h2>
    <p class="metric">analyze · start · validate</p>
    <p>Plus <code>status</code>, <code>resume</code>, and <code>config</code>.</p>
  </article>

  <article class="panel span-4">
    <h2>2 LLM Adapters</h2>
    <p class="metric">agentforce · openai</p>
    <p>Shared provider interface for future expansion.</p>
  </article>

  <article class="panel span-4">
    <h2>1 Goal</h2>
    <p class="metric">safer deploys</p>
    <p>Less guesswork around dependency order, validation, and project readiness.</p>
  </article>
</section>

<section class="cta">
  <h2>Start With The Command Surface</h2>
  <p>
    The most important operational docs are the command reference, AI configuration guide, and known limitations.
    They reflect the current state of the product better than the historical design docs.
  </p>
  <div class="hero-actions">
    <a class="button button--primary" href="{{ site.baseurl }}/commands/">CLI Reference</a>
    <a class="button button--secondary" href="{{ site.baseurl }}/ai/">AI Configuration</a>
    <a class="button button--secondary" href="{{ site.baseurl }}/limitations/">Known Limitations</a>
  </div>
</section>
