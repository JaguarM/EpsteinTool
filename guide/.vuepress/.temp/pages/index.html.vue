<template><div><h1 id="epstein-unredactor-documentation" tabindex="-1"><a class="header-anchor" href="#epstein-unredactor-documentation"><span>Epstein Unredactor Documentation</span></a></h1>
<p>Welcome to the technical documentation for the Epstein Unredactor. This guide covers the internal logic, architecture, and deployment strategies for analyzing redacted documents.</p>
<h2 id="core-concepts" tabindex="-1"><a class="header-anchor" href="#core-concepts"><span>Core Concepts</span></a></h2>
<p>The tool operates on a &quot;Core + Plugin&quot; architecture:</p>
<ul>
<li><strong>Core</strong>: Handles PDF parsing, image extraction, and basic redaction box detection.</li>
<li><strong>Plugins</strong>: Optional features like WebGL masking and typography tools are isolated into independent Django apps for modularity.</li>
</ul>
<h2 id="navigation" tabindex="-1"><a class="header-anchor" href="#navigation"><span>Navigation</span></a></h2>
<ul>
<li><strong><RouteLink to="/architecture/architecture-overview.html">Architecture Overview</RouteLink></strong>: Understand the high-level system design.</li>
<li><strong><RouteLink to="/redaction-processing/backend-logic.html">Backend Logic</RouteLink></strong>: Deep dive into the Python processing pipeline.</li>
<li><strong><RouteLink to="/frontend/JavaScript%20module-reference.html">Frontend Implementation</RouteLink></strong>: Explore the vanilla JS and WebGL rendering engine.</li>
<li><strong><RouteLink to="/api-reference/api-reference.html">API Reference</RouteLink></strong>: Detailed documentation of all JSON endpoints.</li>
<li><strong><RouteLink to="/setup-and-deployment/setup-deployment.html">Setup &amp; Deployment</RouteLink></strong>: Instructions for local development and production.</li>
</ul>
</div></template>


