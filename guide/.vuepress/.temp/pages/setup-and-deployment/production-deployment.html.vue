<template><div><h1 id="production-deployment" tabindex="-1"><a class="header-anchor" href="#production-deployment"><span>Production Deployment</span></a></h1>
<p>Full deployment guide for a Linux server (Ubuntu/Debian) with Gunicorn, Nginx, and SSL.</p>
<h2 id="architecture" tabindex="-1"><a class="header-anchor" href="#architecture"><span>Architecture</span></a></h2>
<div class="language-text line-numbers-mode" data-highlighter="prismjs" data-ext="text"><pre v-pre><code class="language-text"><span class="line">Client → HTTPS (443) → Nginx → Unix Socket → Gunicorn → Django</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div></div></div><p>Nginx handles SSL termination, static files, and proxies dynamic requests to Gunicorn over a Unix socket.</p>
<hr>
<h2 id="automated-setup" tabindex="-1"><a class="header-anchor" href="#automated-setup"><span>Automated Setup</span></a></h2>
<p>The <code v-pre>setup.sh</code> script handles the entire process:</p>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token function">sudo</span> <span class="token function">mkdir</span> <span class="token parameter variable">-p</span> /var/www/epsteintool</span>
<span class="line"><span class="token function">sudo</span> <span class="token function">cp</span> <span class="token parameter variable">-r</span> <span class="token builtin class-name">.</span> /var/www/epsteintool/</span>
<span class="line"><span class="token builtin class-name">cd</span> /var/www/epsteintool</span>
<span class="line"><span class="token function">chmod</span> +x setup.sh</span>
<span class="line"><span class="token function">sudo</span> ./setup.sh</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="what-setup-sh-does" tabindex="-1"><a class="header-anchor" href="#what-setup-sh-does"><span>What <code v-pre>setup.sh</code> does</span></a></h3>
<table>
<thead>
<tr>
<th>Step</th>
<th>Action</th>
</tr>
</thead>
<tbody>
<tr>
<td>1</td>
<td>Updates system, installs Python, Nginx, fonts, HarfBuzz, OpenCV dependencies</td>
</tr>
<tr>
<td>2</td>
<td>Creates Python venv, installs <code v-pre>requirements.txt</code> + Gunicorn</td>
</tr>
<tr>
<td>3</td>
<td>Runs <code v-pre>manage.py migrate</code> and <code v-pre>collectstatic</code></td>
</tr>
<tr>
<td>4</td>
<td>Installs the <code v-pre>epsteintool.service</code> systemd unit</td>
</tr>
<tr>
<td>5</td>
<td>Configures Nginx with <code v-pre>nginx_app.conf</code></td>
</tr>
<tr>
<td>6</td>
<td>Installs SSL certificate via Certbot for <code v-pre>unbarPDF.com</code></td>
</tr>
</tbody>
</table>
<hr>
<h2 id="manual-step-by-step" tabindex="-1"><a class="header-anchor" href="#manual-step-by-step"><span>Manual Step-by-Step</span></a></h2>
<h3 id="_1-systemd-service" tabindex="-1"><a class="header-anchor" href="#_1-systemd-service"><span>1. Systemd Service</span></a></h3>
<p>The file <code v-pre>epsteintool.service</code> runs Gunicorn as <code v-pre>www-data</code>:</p>
<div class="language-ini line-numbers-mode" data-highlighter="prismjs" data-ext="ini"><pre v-pre><code class="language-ini"><span class="line"><span class="token section"><span class="token punctuation">[</span><span class="token section-name selector">Unit</span><span class="token punctuation">]</span></span></span>
<span class="line"><span class="token key attr-name">Description</span><span class="token punctuation">=</span><span class="token value attr-value">EpsteinTool Gunicorn</span></span>
<span class="line"><span class="token key attr-name">After</span><span class="token punctuation">=</span><span class="token value attr-value">network.target</span></span>
<span class="line"></span>
<span class="line"><span class="token section"><span class="token punctuation">[</span><span class="token section-name selector">Service</span><span class="token punctuation">]</span></span></span>
<span class="line"><span class="token key attr-name">User</span><span class="token punctuation">=</span><span class="token value attr-value">www-data</span></span>
<span class="line"><span class="token key attr-name">Group</span><span class="token punctuation">=</span><span class="token value attr-value">www-data</span></span>
<span class="line"><span class="token key attr-name">WorkingDirectory</span><span class="token punctuation">=</span><span class="token value attr-value">/var/www/epsteintool</span></span>
<span class="line"><span class="token key attr-name">ExecStart</span><span class="token punctuation">=</span><span class="token value attr-value">/var/www/epsteintool/venv/bin/gunicorn \</span></span>
<span class="line">    epstein_project.wsgi:application \</span>
<span class="line">    --bind unix:/var/www/epsteintool/epsteintool.sock</span>
<span class="line"></span>
<span class="line"><span class="token section"><span class="token punctuation">[</span><span class="token section-name selector">Install</span><span class="token punctuation">]</span></span></span>
<span class="line"><span class="token key attr-name">WantedBy</span><span class="token punctuation">=</span><span class="token value attr-value">multi-user.target</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token function">sudo</span> <span class="token function">cp</span> epsteintool.service /etc/systemd/system/</span>
<span class="line"><span class="token function">sudo</span> systemctl daemon-reload</span>
<span class="line"><span class="token function">sudo</span> systemctl <span class="token builtin class-name">enable</span> <span class="token parameter variable">--now</span> epsteintool</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="_2-nginx-configuration" tabindex="-1"><a class="header-anchor" href="#_2-nginx-configuration"><span>2. Nginx Configuration</span></a></h3>
<p>The file <code v-pre>nginx_app.conf</code> proxies to the Gunicorn socket and serves static files directly:</p>
<div class="language-nginx line-numbers-mode" data-highlighter="prismjs" data-ext="nginx"><pre v-pre><code class="language-nginx"><span class="line"><span class="token directive"><span class="token keyword">server</span></span> <span class="token punctuation">{</span></span>
<span class="line">    <span class="token directive"><span class="token keyword">listen</span> <span class="token number">80</span></span><span class="token punctuation">;</span></span>
<span class="line">    <span class="token directive"><span class="token keyword">server_name</span> unbarPDF.com</span><span class="token punctuation">;</span></span>
<span class="line"></span>
<span class="line">    <span class="token directive"><span class="token keyword">location</span> /static/</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token directive"><span class="token keyword">alias</span> /var/www/epsteintool/static/</span><span class="token punctuation">;</span></span>
<span class="line">    <span class="token punctuation">}</span></span>
<span class="line"></span>
<span class="line">    <span class="token directive"><span class="token keyword">location</span> /</span> <span class="token punctuation">{</span></span>
<span class="line">        <span class="token directive"><span class="token keyword">proxy_pass</span> http://unix:/var/www/epsteintool/epsteintool.sock</span><span class="token punctuation">;</span></span>
<span class="line">        <span class="token directive"><span class="token keyword">proxy_set_header</span> Host <span class="token variable">$host</span></span><span class="token punctuation">;</span></span>
<span class="line">        <span class="token directive"><span class="token keyword">proxy_set_header</span> X-Forwarded-For <span class="token variable">$proxy_add_x_forwarded_for</span></span><span class="token punctuation">;</span></span>
<span class="line">    <span class="token punctuation">}</span></span>
<span class="line"><span class="token punctuation">}</span></span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token function">sudo</span> <span class="token function">cp</span> nginx_app.conf /etc/nginx/sites-available/epsteintool</span>
<span class="line"><span class="token function">sudo</span> <span class="token function">ln</span> <span class="token parameter variable">-sf</span> /etc/nginx/sites-available/epsteintool /etc/nginx/sites-enabled/</span>
<span class="line"><span class="token function">sudo</span> <span class="token function">rm</span> <span class="token parameter variable">-f</span> /etc/nginx/sites-enabled/default</span>
<span class="line"><span class="token function">sudo</span> nginx <span class="token parameter variable">-t</span> <span class="token operator">&amp;&amp;</span> <span class="token function">sudo</span> systemctl restart nginx</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div><h3 id="_3-ssl-with-certbot" tabindex="-1"><a class="header-anchor" href="#_3-ssl-with-certbot"><span>3. SSL with Certbot</span></a></h3>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token function">sudo</span> <span class="token function">apt-get</span> <span class="token function">install</span> <span class="token parameter variable">-y</span> certbot python3-certbot-nginx</span>
<span class="line"><span class="token function">sudo</span> certbot <span class="token parameter variable">--nginx</span> <span class="token parameter variable">-d</span> unbarPDF.com</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div></div></div><p>Certbot will modify the Nginx config to add HTTPS listeners and auto-renew certificates.</p>
<hr>
<h2 id="troubleshooting" tabindex="-1"><a class="header-anchor" href="#troubleshooting"><span>Troubleshooting</span></a></h2>
<table>
<thead>
<tr>
<th>Issue</th>
<th>Solution</th>
</tr>
</thead>
<tbody>
<tr>
<td><code v-pre>502 Bad Gateway</code></td>
<td>Check if Gunicorn is running: <code v-pre>sudo systemctl status epsteintool</code></td>
</tr>
<tr>
<td>Static files 404</td>
<td>Run <code v-pre>python manage.py collectstatic --noinput</code>, check Nginx <code v-pre>alias</code> path</td>
</tr>
<tr>
<td>Permission denied on socket</td>
<td><code v-pre>sudo chown -R www-data:www-data /var/www/epsteintool</code></td>
</tr>
<tr>
<td>Font widths are wrong</td>
<td>Ensure <code v-pre>assets/fonts/</code> contains the <code v-pre>.ttf</code> files and <code v-pre>fc-cache -fv</code> was run</td>
</tr>
<tr>
<td>Upload too large</td>
<td><code v-pre>DATA_UPLOAD_MAX_MEMORY_SIZE</code> in <code v-pre>settings.py</code> defaults to 50 MB</td>
</tr>
</tbody>
</table>
<h2 id="updating" tabindex="-1"><a class="header-anchor" href="#updating"><span>Updating</span></a></h2>
<div class="language-bash line-numbers-mode" data-highlighter="prismjs" data-ext="sh"><pre v-pre><code class="language-bash"><span class="line"><span class="token builtin class-name">cd</span> /var/www/epsteintool</span>
<span class="line"><span class="token function">git</span> pull</span>
<span class="line"><span class="token builtin class-name">source</span> venv/bin/activate</span>
<span class="line">pip <span class="token function">install</span> <span class="token parameter variable">-r</span> requirements.txt</span>
<span class="line">python3 manage.py migrate</span>
<span class="line">python3 manage.py collectstatic <span class="token parameter variable">--noinput</span></span>
<span class="line"><span class="token function">sudo</span> systemctl restart epsteintool</span>
<span class="line"></span></code></pre>
<div class="line-numbers" aria-hidden="true" style="counter-reset:line-number 0"><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div><div class="line-number"></div></div></div></div></template>


