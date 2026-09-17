"""
Build Static PWA Distribution Script
Renders index.html template with full SGM dataset into self-contained static site inside dist/
Ready for 100% free hosting on GitHub Pages, Vercel, or Netlify.
"""

import os
import shutil
import json
from app import app, load_data, load_base_abilities

def generate_static_site():
    print("Generating static PWA website build...")
    dist_dir = "dist"
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    os.makedirs(dist_dir, exist_ok=True)

    # 1. Copy static assets
    dist_static = os.path.join(dist_dir, "static")
    shutil.copytree("static", dist_static)

    # Copy sw.js to root of dist for full PWA service worker scope
    if os.path.exists("static/sw.js"):
        shutil.copy("static/sw.js", os.path.join(dist_dir, "sw.js"))

    # 2. Render index.html via Flask test client
    with app.test_request_context():
        with app.test_client() as client:
            res = client.get("/")
            html_content = res.get_data(as_text=True)

    # Fix absolute static URLs to relative paths for GitHub Pages subpath compatibility
    html_content = html_content.replace('href="/static/', 'href="static/')
    html_content = html_content.replace('src="/static/', 'src="static/')
    html_content = html_content.replace('navigator.serviceWorker.register("sw.js")', 'navigator.serviceWorker.register("./sw.js")')

    # 3. Write static index.html
    output_html_path = os.path.join(dist_dir, "index.html")
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Static PWA successfully built in '{dist_dir}/'!")
    print(f"Main Entrypoint: {os.path.abspath(output_html_path)}")

if __name__ == "__main__":
    generate_static_site()
