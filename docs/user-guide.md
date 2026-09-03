# SmartQuote Pro — quick guide

Browser quoting tool for Goldco supply & install. Quotes live **on this browser only** (no login, no server yet). Clearing site data or using another device will lose them.

Start with `npm install` then `npm run dev`.

---

## Pages

| Nav | What it is |
|-----|------------|
| **Products** | Pick a product line and price a size |
| **Add-ons** | Flat extras (tracks, locks, call-out, etc.) |
| **Quote** | Customer details, lines, totals, issue / PDF |
| **Sheet** | Site measure drawings (not added to the quote automatically) |
| **Saved** | All quotes, by deal status |
| **Admin** | Company header, bank, deposit rate, colour extra |

---

## Make a quote

1. **Products** → choose a line (e.g. Supascreen).
2. Enter **height** and **width** in mm. The app bills the next size **up** in the matrix.
3. Optional: mesh type, fit extras (top track, lock post, …), room, notes.
4. If the size is OK, **Add to quote**. If you see “too large” or “not available”, it cannot be auto-priced.
5. Repeat, or use **Add-ons** for flat items. Price-on-request lines need a price typed in first.
6. Open **Quote**. Fill customer / phone / address, date, optional suffix (`SS`, `DG`…), frame colour.
7. Uncheck **Ship To is the same as Bill To** if delivery is different.
8. Non-standard colours add a powder-coat extra (default $220; you can change it on this quote). GST is 10% when the checkbox is on.

The paper preview under the form is what the customer sees. You can edit qty, description, and unit price on the lines until the quote is issued.

---

## Save, issue, revise

| Button | What it does |
|--------|----------------|
| **Save quote** | Keep a copy on this browser. Does not lock prices. |
| **Issue quote** | Lock lines and totals. Later price-list changes will not change this version. Needs at least one line. |
| **Revise quote** | After issue: same quote number, new Rev. Old issued copy stays in Saved. |
| **New quote** | Fresh number. Save first if you still need the current one. |
| **Clear items** | Empty the line list only. |
| **Save as PDF** | Preview, then download. |
| **Print quote** | Browser print dialog. |
| **Amount paid** | Always editable, even after issue. |

**Issue** is not “deal won”. Use Saved to mark **Close deal** or **Abandon**.

---

## Saved quotes

Filter: **All** / **In progress** / **Abandoned** / **Closed**.

- **Open** — load that revision into Quote (you’ll be asked if the current editor has work).
- **Snapshot** — look at a revision (including photos) without opening it.
- **Delete** — removes that revision only.
- **Abandon / Close deal / Reopen** — applies to the whole quote number.
- Comments sit under each revision (why the customer changed something, etc.).

---

## Price list & Admin

On **Products**, drag an updated `.xlsx` (same template as the bundled list) to price from that file. Refreshing the page restores the built-in list. **Restore default price list** does the same.

**Admin** drives the quote header/footer (company, ABN, bank, validity days, deposit rate, colour extra, terms). Save is per browser; there is no staff login yet. Changing deposit or colour extra does **not** rewrite an already **issued** quote.

---

## Sheet (site measure)

**Sheet** → pick a door/window drawing → mark H/W points on the picture and type millimetres. Brush/eraser are for markup only. **Save measurements** stays on this browser; it does **not** add a product line. After you know the size, price it under **Products**.

---

## Tips

- Quote numbers start at `00033021` and count up. A suffix prints as `00033021-SS`. Revise does not change the number.
- Photos attach per room on the quote paper. Very large photos may be dropped when saving.
- Issued or abandoned/closed quotes cannot get new lines until you **Revise**, **Reopen**, or **New quote**.
- Grille is not in the calculator (source sheet is not for pricing).
