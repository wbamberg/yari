import fs from "fs";
import path from "path";
import frontmatter from "front-matter";

import { DocFrontmatter } from "../libs/types/document";

// Module-level cache: as we calculate sequences we will add them here,
// so we don't have to recalculate them.
const pageSequences = {};

/**
 * Creates and returns an array containing an entry for every child
 * page under `parent`. Each entry contains the slug and weight
 * value for that child.
 *
 * If *any* children of `parent` don't contain guide pages with weight set,
 * the whole sequence is invalid and we return an empty array.
 *
 * @param parent Parent directory for sequence.
 * @returns
 */
function makeSequence(parent) {
  // Get child directories of `parent`
  const children = fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  const sequence = [];
  for (const child of children) {
    try {
      // Try to open a docs page and read front matter
      const contents = fs.readFileSync(
        path.join(parent, child.name, "index.md"),
        { encoding: "utf8" }
      );
      const matter = frontmatter<DocFrontmatter>(contents).attributes;
      // If it is a guide page and has weight set, add it to the sequence
      if (matter["page-type"] === "guide" && matter.weight !== undefined) {
        sequence.push({
          slug: matter.slug,
          weight: matter.weight,
        });
      }
    } catch (e) {
      // Ignore errors: the most likely error is that this directory
      // did not contain an index.md page.
    }
  }
  // Only count sequences where *every* child is represented
  // (meaning, every child is a guide with weight set).
  // Otherwise return an empty sequence here just to indicate that
  // we have checked this parent's children before, so we don't try
  // again.
  if (children.length === sequence.length) {
    // Sort sequence by weight
    return sequence.sort((a, b) => {
      if (a.weight > b.weight) {
        return 1;
      }
      if (a.weight < b.weight) {
        return -1;
      }
      return 0;
    });
  }
  return [];
}

/**
 * Given a page identified by `slug`, and the sequence of which
 * it is a part, return the sequence entry before this page and
 * the sequence entry after this page.
 *
 * @param slug slug of the current page
 * @param sequence current page and siblings, ordered by weight
 * @returns entries for the previous and next entries in the sequence
 */
function getPreviousNextEntries(slug, sequence) {
  const pnEntries = {
    previous: null,
    next: null,
  };

  const pageIndex = sequence.findIndex((page) => page.slug === slug);
  if (pageIndex > 0) {
    pnEntries.previous = sequence[pageIndex - 1];
  }
  if (pageIndex < sequence.length - 1) {
    pnEntries.next = sequence[pageIndex + 1];
  }

  return pnEntries;
}

/**
 * Generate the HTML for a nav button.
 *
 * TODO localize labels.
 *
 * @param locale
 * @param slug
 * @param label
 * @returns string
 */
function renderButton(locale, slug, label) {
  let button = `<li><a class="button secondary"`;
  button += `href="/${locale}/docs/${slug}">`;
  button += `<span class="button-wrap"> ${label} </span></a></li>`;
  return button;
}

/**
 * Generate HTML for all the buttons and add it to the document.
 *
 * @param $
 * @param locale
 * @param slug
 * @param pnEntries
 * @returns
 */
function renderButtons($, locale, slug, pnEntries) {
  if (!pnEntries.previous && !pnEntries.next) {
    return;
  }
  let buttons = '<ul class="prev-next">';

  if (pnEntries.previous) {
    buttons += `${renderButton(locale, pnEntries.previous.slug, "Previous")}`;
  }

  const parentSlug = slug.split("/").slice(0, -1).join("/");
  buttons += `${renderButton(locale, parentSlug, "Overview")}`;

  if (pnEntries.next) {
    buttons += `${renderButton(locale, pnEntries.next.slug, "Next")}`;
  }

  buttons += `</ul>`;
  $("body").prepend(buttons);
}

/**
 * Add Next/Previous buttons to a page, if it is part of a sequence of pages.
 * A page sequence is a set of sibling pages which are all guide pages
 * and all have `weight` set.
 *
 * @param $
 * @param locale
 * @param fileInfo
 * @param slug
 */

export function injectPreviousNext($, locale, fileInfo, slug) {
  const parent = path.join(fileInfo.root, fileInfo.folder, "../");
  // Look for this sequence in the cache.
  let sequence = pageSequences[parent];

  if (!sequence) {
    // Make a sequence and cache it.
    sequence = makeSequence(parent);
    pageSequences[parent] = sequence;
  }

  const pnEntries = getPreviousNextEntries(slug, sequence);
  renderButtons($, locale, slug, pnEntries);
}
