---
name: csv-data-analysis
description: Profiles and analyzes CSV or spreadsheet exports to answer a concrete question, checking data quality before computing anything and reporting numbers with their caveats. Use when asked to "analyze this CSV", "what does this data show", "summarize this export", "find trends in this spreadsheet", "clean this data", or when given a .csv/.tsv file and a business question.
license: MIT
---

# CSV Data Analysis

Answer the user's question from a tabular file without fooling them. Most wrong answers from CSVs come from unexamined data: duplicated rows, mixed units, blanks read as zero, dates parsed in the wrong format, totals rows counted as data. Profile first, decide what the data can support, then compute and explain.

## Workflow

1. **Pin down the question.** Restate it as a measurable quantity ("monthly revenue by region, 2025", not "how are sales"). If the user gave no question, profile and propose the three most useful questions the data can answer.
2. **Profile the file.** From the skill directory run:
   `python3 scripts/profile_csv.py <file.csv>`
   Options: `--delimiter ';'`, `--top 10`, `--max-rows 500000`. It prints a markdown table per column (inferred type, non-null and null counts, distinct count, min/max/mean for numbers and dates, top values) and exits 0, or 2 on a bad path or unreadable file.
3. **Inspect quality** using the profile (checklist below). Look at 10-20 raw rows, including the first and last few, before trusting the profile.
4. **Decide and state cleaning steps**: which rows you drop or fix, and why. Never clean silently.
5. **Compute** with the tool available: pandas or DuckDB if installed, otherwise Python stdlib or SQL on SQLite. Keep the code so it can be rerun; show it if the user is technical.
6. **Sanity-check results**: totals reconcile with the raw sum, row counts add up across groups, magnitudes are plausible, and a hand-computed spot check matches.
7. **Report** in the Output format. Lead with the answer.

## Quality checklist

- **Header and footer rows**: report titles above the header, "Total" rows at the bottom, blank trailing lines.
- **Duplicates**: exact duplicate rows and duplicate IDs. Ask whether duplicates are real events.
- **Nulls in disguise**: `""`, `NA`, `N/A`, `null`, `-`, `0` used as "unknown". The profiler counts common null tokens.
- **Mixed types** in a column (numbers with some text), thousands separators (`1,234`), currency symbols, percent signs, European decimals (`1.234,56`).
- **Dates**: ambiguous day/month (`03/04/2025`), mixed formats, time zones, Excel serial numbers (`45123`).
- **Units and currency**: mixed currencies or units in one column; cents vs dollars.
- **Coverage**: date range and gaps (missing months make trends lie), segments that appear only part of the time.
- **Outliers**: check the top values of numeric columns; a single test order of 9,999,999 dominates a mean.
- **Cardinality**: an "ID" column with fewer distinct values than rows; a category column with 5,000 distinct values (free text).

## Analysis rules

- **Medians alongside means** for money, durations, and anything skewed.
- **Show denominators.** "42% (210 of 500 accounts)" not "42%".
- **Compare like periods.** Partial current month vs full prior month is the most common false "drop".
- **Correlation is not cause.** Say "associated with" unless the data comes from an experiment.
- **Small groups**: flag segments with under about 30 rows; do not rank them against large ones.
- **Round for reading** (2-3 significant figures in prose), keep precision in tables.
- **Charts only when they add something**: a time series or a distribution. Label axes with units.

## Example

Bad:
> Average order value is $1,284 and sales dropped 60% in October.

Good:
> Median order value is $64 (mean $1,284 is distorted by 3 orders over $500k, which look like test data: customer "TEST", dated 2025-06-01). Excluding them, the mean is $71.
> October looks 60% lower only because the export ends on Oct 12; on a per-day basis October is up 4% on September (312 vs 300 orders/day).

## Output

```
## Answer
<1-3 sentences that directly answer the question, with the key number and its denominator>

## Data used
- File: <name>, <rows> rows x <cols> columns, covering <date range>
- Cleaning: <each step and rows affected>

## Findings
| <dimension> | <metric> | <n> |
|---|---|---|

<2-5 bullet observations, each with numbers>

## Caveats
- <data limits that could change the conclusion>

## Next questions
- <what you would check with more data or time>
```
Attach or show the analysis code if the user wants to rerun it.
