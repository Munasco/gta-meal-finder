/* Meal Finder browser bridge.
 * Run on any ubereats.com store or search page (bookmarklet or DevTools console).
 * Reads the menu the page already shows you and sends it to your local Meal Finder.
 */
(function () {
  var APP = (window.__MEAL_FINDER_APP__ || "http://127.0.0.1:5173").replace(/\/$/, "");

  function text(el) { return (el && (el.innerText || el.textContent) || "").trim(); }
  function price(v) {
    if (typeof v === "number") return v;
    var m = String(v || "").replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
    return m ? Number(m[1]) : null;
  }
  function pl() {
    var m = location.search.match(/[?&]pl=([^&]+)/);
    if (m) return m[1];
    var c = document.cookie.match(/(?:^|;\s*)uev2\.loc=([^;]+)/);
    return c ? btoa(c[1]) : null;
  }

  /* 1. JSON-LD (store pages embed the full menu with prices) */
  function fromJsonLd() {
    var out = [];
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      var data;
      try { data = JSON.parse(scripts[i].textContent); } catch (e) { continue; }
      var nodes = Array.isArray(data) ? data : [data];
      nodes.forEach(function (node) {
        if (!node || typeof node !== "object") return;
        var menu = node.hasMenu || (node["@type"] === "Menu" ? node : null);
        if (!menu) return;
        var sections = [].concat(menu.hasMenuSection || []);
        var items = [];
        sections.forEach(function (sec) {
          [].concat(sec.hasMenuItem || []).forEach(function (it) {
            if (!it || !it.name) return;
            var offer = Array.isArray(it.offers) ? it.offers[0] : it.offers;
            items.push({
              name: String(it.name).trim(),
              description: String(it.description || "").trim(),
              price: price(offer && (offer.price || offer.lowPrice)),
              section: String(sec.name || "").trim() || null,
              imageUrl: typeof it.image === "string" ? it.image : null,
            });
          });
        });
        if (items.length) {
          out.push({
            restaurant: String(node.name || text(document.querySelector("h1")) || "Restaurant").trim(),
            storeUrl: location.href.split("?")[0],
            rating: node.aggregateRating ? price(node.aggregateRating.ratingValue) : null,
            address: node.address && typeof node.address === "object" ? [node.address.streetAddress, node.address.addressLocality].filter(Boolean).join(", ") : null,
            items: items,
          });
        }
      });
    }
    return out;
  }

  /* 2. DOM fallback: cards that contain exactly one price */
  function fromDom() {
    var seen = {};
    var items = [];
    var all = document.body.querySelectorAll("span, div, p");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length > 0) continue;
      var t = text(el);
      if (!/^(CA)?\$\s?\d+(\.\d{2})?$/.test(t)) continue;
      var card = el, hops = 0;
      while (card.parentElement && hops < 8) {
        card = card.parentElement; hops++;
        var prices = text(card).match(/\$\s?\d+(\.\d{2})?/g) || [];
        if (prices.length === 1 && text(card).length > t.length + 3) break;
      }
      var lines = text(card).split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      var name = lines.filter(function (l) { return !/^\$|^CA\$/.test(l) && l.length > 2 && l.length < 90; })[0];
      if (!name || seen[name]) continue;
      seen[name] = 1;
      items.push({ name: name, description: lines.filter(function (l) { return l !== name && !/^\$|^CA\$/.test(l); })[0] || "", price: price(t), section: null, imageUrl: null });
    }
    if (!items.length) return [];
    return [{ restaurant: text(document.querySelector("h1")) || document.title.replace(/\s*\|.*$/, ""), storeUrl: location.href.split("?")[0], rating: null, address: null, items: items }];
  }

  /* 3. Search page: store links only (open a store to capture its menu) */
  function storesFromSearch() {
    var links = document.querySelectorAll('a[href*="/store/"]');
    var seen = {}, out = [];
    for (var i = 0; i < links.length; i++) {
      var href = links[i].href.split("?")[0];
      var name = text(links[i]).split("\n")[0];
      if (!name || seen[href]) continue;
      seen[href] = 1;
      out.push({ restaurant: name, storeUrl: href, rating: null, address: null, items: [] });
    }
    return out;
  }

  var restaurants = fromJsonLd();
  if (!restaurants.length) restaurants = fromDom();
  if (!restaurants.length) restaurants = storesFromSearch();

  var payload = { source: "browser", capturedAt: new Date().toISOString(), pageUrl: location.href, pl: pl(), restaurants: restaurants };
  var itemCount = restaurants.reduce(function (n, r) { return n + r.items.length; }, 0);

  function toast(msg, ok) {
    var d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = "position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);padding:10px 14px;border-radius:999px;font:500 13px/1.3 Inter,system-ui,sans-serif;color:#fff;background:" + (ok ? "#0a0a0a" : "#dc2626") + ";box-shadow:0 8px 24px rgba(0,0,0,.2)";
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 3500);
  }

  if (!restaurants.length) { toast("Nothing to capture on this page. Open a restaurant's menu.", false); return; }

  // targetAddressSpace lets an https page talk to a local http server in Chrome (Local Network Access).
  var body = JSON.stringify(payload);
  function post(url) {
    return fetch(url, { method: "POST", mode: "cors", targetAddressSpace: "loopback", headers: { "Content-Type": "application/json" }, body: body })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  // App first; the local helper (bun run bridge) second; clipboard last.
  post(APP + "/api/ingest")
    .catch(function () { return post("http://127.0.0.1:5174/ingest"); })
    .then(function () { toast("Sent " + restaurants.length + " restaurant(s), " + itemCount + " items to Meal Finder", true); })
    .catch(function () {
      var json = JSON.stringify(payload);
      var done = function () { toast("Copied " + itemCount + " items. Paste in Meal Finder → Connections.", true); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(done, function () { prompt("Copy this and paste in Meal Finder:", json); });
      else prompt("Copy this and paste in Meal Finder:", json);
    });
})();
