<template><div><h1 id="setup-deployment" tabindex="-1"><a class="header-anchor" href="#setup-deployment"><span>Setup &amp; Deployment</span></a></h1>
<p>This section covers everything needed to run the Epstein Unredactor, from local development to production server deployment.</p>
<h2 id="contents" tabindex="-1"><a class="header-anchor" href="#contents"><span>Contents</span></a></h2>
<table>
<thead>
<tr>
<th>Document</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td><RouteLink to="/setup-and-deployment/local-development.html">Local Development</RouteLink></td>
<td>Setting up a dev environment on Windows or Linux</td>
</tr>
<tr>
<td><RouteLink to="/setup-and-deployment/production-deployment.html">Production Deployment</RouteLink></td>
<td>Full Linux server setup with Gunicorn, Nginx, and SSL</td>
</tr>
</tbody>
</table>
<h2 id="prerequisites" tabindex="-1"><a class="header-anchor" href="#prerequisites"><span>Prerequisites</span></a></h2>
<ul>
<li><strong>Python 3.10+</strong></li>
<li><strong>pip</strong> and <strong>venv</strong></li>
<li>System libraries: <code v-pre>libgl1</code>, <code v-pre>libglib2.0-0</code>, <code v-pre>libharfbuzz-dev</code> (Linux)</li>
<li>Microsoft Core Fonts (for accurate width calculation)</li>
</ul>
<h2 id="dependencies" tabindex="-1"><a class="header-anchor" href="#dependencies"><span>Dependencies</span></a></h2>
<table>
<thead>
<tr>
<th>Package</th>
<th>Purpose</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>django</code></td>
<td>Web framework</td>
</tr>
<tr>
<td><code v-pre>opencv-python-headless</code></td>
<td>Image analysis (box detection)</td>
</tr>
<tr>
<td><code v-pre>numpy</code></td>
<td>Array operations for image processing</td>
</tr>
<tr>
<td><code v-pre>pymupdf</code></td>
<td>PDF parsing and image extraction</td>
</tr>
<tr>
<td><code v-pre>pillow</code></td>
<td>Image format conversions, mask generation</td>
</tr>
<tr>
<td><code v-pre>uharfbuzz</code></td>
<td>Precision text shaping with kerning/ligature support</td>
</tr>
<tr>
<td><code v-pre>gunicorn</code></td>
<td>Production WSGI server</td>
</tr>
</tbody>
</table>
</div></template>


