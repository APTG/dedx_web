// PEG grammar for shareable-URL query strings (v2).
//
// Normative source: docs/04-feature-specs/shareable-urls-formal.md §2.
// Produces the AST defined in url-ast.ts. Compiled at build/test time by the
// inline Peggy loader in vite.config.ts; there is no committed generated file.
//
// Design: list-bearing params (energies, series, mat_elements, entity lists)
// parse into structured items ONLY when the whole value is clean; otherwise the
// rule falls back to capturing the verbatim `raw` value, so the resolver can
// apply exactly the lenient splitting the original decoder used. Every node
// carries a source span (offsets into the query string) for precise errors.

{{
  function spanOf(loc) {
    return { start: loc.start.offset, end: loc.end.offset };
  }
}}

// query = [pair *("&" [pair])]
Query
  = head:Pair? tail:(Amp @Pair?)* {
      const pairs = [];
      if (head) pairs.push(head);
      for (const p of tail) if (p) pairs.push(p);
      return { type: "query", pairs };
    }

Amp = "&"

// Structured pairs first (each is anchored by its own "key=" literal), then
// known scalar pairs, then the catch-all unknown pair.
Pair
  = ExtdataPair
  / EnergiesPair
  / LookupsPair
  / SeriesPair
  / MatElementsPair
  / EntityListPair
  / ScalarPair
  / UnknownPair

// ── extdata = label ":" url (label is the text up to the first ':') ──────────
ExtdataPair
  = "extdata=" raw:RawValue {
      const i = raw.indexOf(":");
      return {
        type: "extdata",
        key: "extdata",
        label: i > 0 ? raw.slice(0, i) : raw,
        url: i > 0 ? raw.slice(i + 1) : "",
        span: spanOf(location()),
      };
    }

// ── energies = energy-item *("," energy-item) ────────────────────────────────
EnergiesPair
  = "energies=" v:EnergiesValue {
      return { type: "energies", key: "energies", items: v.items, raw: v.raw, span: spanOf(location()) };
    }
EnergiesValue
  = items:EnergyItemList EndOfValue { return { items, raw: text() }; }
  / raw:RawValue { return { items: null, raw }; }
EnergyItemList
  = head:EnergyItem tail:("," @EnergyItem)* { return [head, ...tail]; }
EnergyItem
  = v:Number u:(":" @EnergyUnitToken)? {
      return { value: v, unit: u ?? null, span: spanOf(location()) };
    }

// ── lookups / ivalues = lookup-item *("," lookup-item) ───────────────────────
LookupsPair
  = key:LookupsKey "=" v:LookupsValue {
      return { type: "lookups", key, items: v.items, raw: v.raw, span: spanOf(location()) };
    }
LookupsKey = "lookups" / "ivalues"
LookupsValue
  = items:LookupItemList EndOfValue { return { items, raw: text() }; }
  / raw:RawValue { return { items: null, raw }; }
LookupItemList
  = head:LookupItem tail:("," @LookupItem)* { return [head, ...tail]; }
LookupItem
  = v:Number u:(":" @LookupUnitToken)? {
      return { value: v, unit: u ?? null, span: spanOf(location()) };
    }

// ── series = series-item *("," series-item) ──────────────────────────────────
SeriesPair
  = "series=" v:SeriesValue {
      return { type: "series", key: "series", items: v.items, raw: v.raw, span: spanOf(location()) };
    }
SeriesValue
  = items:SeriesItemList EndOfValue { return { items, raw: text() }; }
  / raw:RawValue { return { items: null, raw }; }
SeriesItemList
  = head:SeriesItem tail:("," @SeriesItem)* { return [head, ...tail]; }
SeriesItem
  = p:EntityId "." pt:EntityId "." m:EntityId {
      return { program: p, particle: pt, material: m, span: spanOf(location()) };
    }

// ── mat_elements = mat-element *("," mat-element) ────────────────────────────
MatElementsPair
  = "mat_elements=" v:MatElementsValue {
      return { type: "mat-elements", key: "mat_elements", elements: v.elements, raw: v.raw, span: spanOf(location()) };
    }
MatElementsValue
  = elements:MatElementList EndOfValue { return { elements, raw: text() }; }
  / raw:RawValue { return { elements: null, raw }; }
MatElementList
  = head:MatElement tail:("," @MatElement)* { return [head, ...tail]; }
MatElement
  = z:Digits ":" c:Number { return { z, count: c, span: spanOf(location()) }; }

// ── entity lists: programs / particles / materials / hidden_programs ─────────
EntityListPair
  = key:EntityListKey "=" v:EntityListValue {
      return { type: "entity-list", key, ids: v.ids, raw: v.raw, span: spanOf(location()) };
    }
EntityListKey = "programs" / "particles" / "materials" / "hidden_programs"
EntityListValue
  = ids:EntityIdList EndOfValue { return { ids, raw: text() }; }
  / raw:RawValue { return { ids: null, raw }; }
EntityIdList
  = head:EntityId tail:("," @EntityId)* { return [head, ...tail]; }

// ── known scalar params (value kept verbatim) ────────────────────────────────
ScalarPair
  = key:ScalarKey "=" value:RawValue {
      return { type: "scalar", key, value, span: spanOf(location()) };
    }
// Longer keys that share a prefix with a shorter one are listed first so the
// ordered choice does not stop early (e.g. mat_density before density).
ScalarKey
  = "urlv" / "mode" / "calc"
  / "particle" / "material" / "program"
  / "eunit" / "uanchor" / "runit" / "sunit"
  / "qshow" / "qfocus" / "imode" / "iunit" / "istpbranch"
  / "tip_seen" / "across"
  / "stp_unit" / "xscale" / "yscale" / "inv_stp_branch"
  / "agg_state" / "interp_scale" / "interp_method" / "mstar_mode"
  / "mat_name" / "mat_density" / "mat_ival" / "mat_phase"
  / "density" / "ival"

// ── unknown pair (forward-compatible; dropped by the resolver) ───────────────
// Two forms so the grammar stays total over any `URLSearchParams.toString()`
// output (which may contain empty keys, e.g. "=oops"): a non-empty key with an
// optional value, or a leading "=" with an empty key. Keeping the grammar total
// means a malformed segment never discards the valid params around it.
UnknownPair
  = key:$[^&=]+ value:("=" @RawValue)? {
      return { type: "unknown", key, value: value ?? "", span: spanOf(location()) };
    }
  / "=" value:RawValue {
      return { type: "unknown", key: "", value, span: spanOf(location()) };
    }

// ── shared lexical rules ─────────────────────────────────────────────────────
EntityId
  = $("ext:" [A-Za-z0-9_-]+ ":" [A-Za-z0-9_-]+)
  / Digits

// energy-unit-token (the VALID_ROW_UNITS set). Compound forms first.
EnergyUnitToken
  = "keV/nucl" / "MeV/nucl" / "GeV/nucl" / "TeV/nucl"
  / "keV/u" / "MeV/u" / "GeV/u" / "TeV/u"
  / "keV" / "MeV" / "GeV" / "TeV" / "eV"

// lookup-unit-token — any token up to the next delimiter ('=' may not appear in
// a value). Validation of the actual unit happens in the resolver.
LookupUnitToken = $[^,&:]+

Number "a number" = $([0-9]+ ("." [0-9]+)? ([eE] [+\-]? [0-9]+)?)
Digits "an integer" = $[0-9]+
RawValue = $[^&]*

// end-of-value guard: the next char must be '&' or end of input, otherwise the
// structured alternative is rejected and the rule falls back to RawValue.
EndOfValue = &"&" / !.
