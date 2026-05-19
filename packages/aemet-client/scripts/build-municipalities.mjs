#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "src", "data", "municipalities.json");

// Any Spanish entity that carries an INE municipal code (P772) is a municipality.
// We deliberately do NOT filter by `wdt:P31 wd:Q2074737` because Wikidata tags
// Catalan, Galician, Basque and several other municipalities with more specific
// P31 values that aren't direct instances of Q2074737, which silently dropped
// ~2000 municipalities (all of Barcelona, Girona, Lleida, Lugo, Ourense, most
// of La Rioja, A Coruña, Asturias, Pontevedra, Tarragona…).
const query = `SELECT DISTINCT ?ineCode ?label ?lat ?lon WHERE {
  ?municipio wdt:P772 ?ineCode.
  ?municipio wdt:P17 wd:Q29.
  ?municipio wdt:P625 ?coord.
  ?municipio rdfs:label ?label FILTER (lang(?label) = "es").
  FILTER REGEX(?ineCode, "^[0-9]{5}$").
  BIND (geof:longitude(?coord) AS ?lon).
  BIND (geof:latitude(?coord) AS ?lat).
}`;

const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`;

const response = await fetch(url, {
  headers: {
    accept: "application/sparql-results+json",
    "user-agent": "aemet-client-dataset-build/1.0 (https://github.com/jocarrd/aemet-client)",
  },
});

if (!response.ok) {
  throw new Error(`Wikidata SPARQL returned ${response.status}: ${await response.text()}`);
}

const payload = await response.json();
const seen = new Map();
for (const binding of payload.results.bindings) {
  const code = binding.ineCode.value;
  if (!/^\d{5}$/.test(code) || seen.has(code)) continue;
  seen.set(code, {
    ineCode: code,
    name: binding.label.value,
    lat: Math.round(Number(binding.lat.value) * 1e5) / 1e5,
    lon: Math.round(Number(binding.lon.value) * 1e5) / 1e5,
  });
}

const municipalities = [...seen.values()].sort((a, b) => a.ineCode.localeCompare(b.ineCode));
writeFileSync(out, JSON.stringify(municipalities));
console.log(`Wrote ${municipalities.length} municipalities to ${out}`);
