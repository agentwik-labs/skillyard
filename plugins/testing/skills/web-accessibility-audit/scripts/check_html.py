#!/usr/bin/env python3
"""Static accessibility checks for HTML files.

Checks: missing <html lang>, <img> without alt, form controls without a label,
buttons/links without an accessible name, missing or multiple <h1>, heading
level skips, positive tabindex, duplicate ids, autoplaying media.
Prints file:line: [rule] message.
Exit codes: 0 = no issues, 1 = issues found, 2 = usage error.
Python 3.9+, standard library only.
"""
import argparse
import os
import sys
from html.parser import HTMLParser
from typing import Dict, List, Optional, Tuple

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
        "source", "track", "wbr"}
LABELABLE = {"input", "select", "textarea"}
NO_LABEL_INPUT_TYPES = {"hidden", "submit", "reset", "button", "image"}


class Checker(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.issues: List[Tuple[int, str, str]] = []
        self.html_lang: Optional[bool] = None
        self.label_for: set = set()
        self.ids: Dict[str, int] = {}
        self.controls: List[Tuple[int, str, Dict[str, str], bool]] = []
        self.label_depth = 0
        self.h1_count = 0
        self.last_heading = 0
        # stack of open name-requiring elements: [tag, line, attrs, text_parts, has_named_img]
        self.name_stack: List[list] = []

    def add(self, rule: str, msg: str, line: Optional[int] = None) -> None:
        self.issues.append((line or self.getpos()[0], rule, msg))

    def handle_starttag(self, tag: str, attrs_list) -> None:
        attrs = {k: (v if v is not None else "") for k, v in attrs_list}
        line = self.getpos()[0]
        if tag == "html":
            self.html_lang = bool(attrs.get("lang", "").strip())
        if "id" in attrs and attrs["id"]:
            if attrs["id"] in self.ids:
                self.add("duplicate-id", 'id="%s" also used on line %d' % (attrs["id"], self.ids[attrs["id"]]))
            else:
                self.ids[attrs["id"]] = line
        ti = attrs.get("tabindex", "").strip()
        if ti.lstrip("-").isdigit() and int(ti) > 0:
            self.add("positive-tabindex", '<%s tabindex="%s"> breaks natural focus order' % (tag, ti))
        if tag in ("video", "audio") and "autoplay" in attrs:
            self.add("autoplay-media", "<%s autoplay> starts media without user control" % tag)
        if tag == "img":
            if "alt" not in attrs and attrs.get("role") not in ("presentation", "none") \
                    and attrs.get("aria-hidden") != "true":
                self.add("img-alt", '<img src="%s"> has no alt attribute (use alt="" if decorative)'
                         % attrs.get("src", "")[:60])
            if self.name_stack and attrs.get("alt", "").strip():
                self.name_stack[-1][4] = True
        if tag == "label":
            self.label_depth += 1
            if attrs.get("for"):
                self.label_for.add(attrs["for"])
        if tag in LABELABLE:
            itype = attrs.get("type", "text").lower()
            if not (tag == "input" and itype in NO_LABEL_INPUT_TYPES):
                self.controls.append((line, tag, attrs, self.label_depth > 0))
            if tag == "input" and itype == "image" and not attrs.get("alt", "").strip():
                self.add("input-image-alt", '<input type="image"> needs alt text')
        if tag in ("button", "a") or attrs.get("role") in ("button", "link"):
            if tag == "a" and "href" not in attrs and not attrs.get("role"):
                pass
            elif tag not in VOID:
                self.name_stack.append([tag, line, attrs, [], False])
        if len(tag) == 2 and tag[0] == "h" and tag[1] in "123456":
            level = int(tag[1])
            if level == 1:
                self.h1_count += 1
            if self.last_heading and level > self.last_heading + 1:
                self.add("heading-skip", "<%s> follows <h%d>; heading levels should not skip"
                         % (tag, self.last_heading))
            self.last_heading = level

    def handle_startendtag(self, tag: str, attrs_list) -> None:
        self.handle_starttag(tag, attrs_list)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        if self.name_stack and data.strip():
            self.name_stack[-1][3].append(data.strip())

    def handle_endtag(self, tag: str) -> None:
        if tag == "label" and self.label_depth:
            self.label_depth -= 1
        if self.name_stack and self.name_stack[-1][0] == tag:
            t, line, attrs, text, named_img = self.name_stack.pop()
            has_name = bool(text) or named_img or any(
                attrs.get(k, "").strip() for k in ("aria-label", "aria-labelledby", "title"))
            if not has_name:
                kind = "button" if (t == "button" or attrs.get("role") == "button") else "link"
                self.add("%s-name" % kind, "<%s> has no accessible name (text, aria-label, or img alt)" % t, line)
            if self.name_stack and (text or named_img):
                self.name_stack[-1][3].extend(text)

    def finish(self) -> None:
        if self.html_lang is False:
            self.add("html-lang", "<html> is missing a non-empty lang attribute", 1)
        for line, tag, attrs, wrapped in self.controls:
            cid = attrs.get("id", "")
            if wrapped or (cid and cid in self.label_for):
                continue
            if any(attrs.get(k, "").strip() for k in ("aria-label", "aria-labelledby")):
                continue
            hint = " (placeholder is not a label)" if attrs.get("placeholder") else ""
            self.add("form-label", "<%s name=\"%s\"> has no associated label%s"
                     % (tag, attrs.get("name", cid), hint), line)
        if self.html_lang is not None:
            if self.h1_count == 0:
                self.add("h1-missing", "page has no <h1>", 1)
            elif self.h1_count > 1:
                self.add("h1-multiple", "page has %d <h1> elements" % self.h1_count, 1)


def check_file(path: str) -> List[str]:
    with open(path, encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    c = Checker()
    c.feed(text)
    c.close()
    c.finish()
    return ["%s:%d: [%s] %s" % (path, ln, rule, msg) for ln, rule, msg in sorted(c.issues)]


def iter_paths(paths: List[str]):
    for p in paths:
        if os.path.isdir(p):
            for dp, dns, fns in os.walk(p):
                dns[:] = [d for d in dns if d not in (".git", "node_modules", "dist", "build")]
                for fn in sorted(fns):
                    if fn.lower().endswith((".html", ".htm")):
                        yield os.path.join(dp, fn)
        else:
            yield p


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Static accessibility checks for HTML files. "
                                 "Exit 0 = clean, 1 = issues, 2 = usage error.")
    ap.add_argument("paths", nargs="+", help="HTML files or directories")
    args = ap.parse_args(argv)
    issues: List[str] = []
    checked = 0
    for p in iter_paths(args.paths):
        if not os.path.isfile(p):
            print("error: no such file: %s" % p, file=sys.stderr)
            return 2
        issues += check_file(p)
        checked += 1
    for i in issues:
        print(i)
    print("%d issue(s) in %d file(s)" % (len(issues), checked), file=sys.stderr)
    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main())
