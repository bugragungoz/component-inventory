# Order page fixtures

Cut on 2026-10-03 from real, logged-in order detail pages on the owner's laptop. Only the product
list part of each page is kept; order numbers, cargo tracking, customer names and addresses were
removed, scripts, images and inline handlers stripped. Every text node and attribute was read before
commit. The markup (class names, nesting) is the shops' own, so extractors tested here match the live
sites as of that date.

| File | Shop | Page | Lines |
|---|---|---|---|
| `ozdisan-order-detail.html` | Özdisan | `/kontrol-paneli/siparis-durum-gecmisi/siparis-detay/<id>/ozet`, body table | 14 |
| `motorobit-order-detail.html` | Motorobit (T-Soft, Tailwind) | `/uye-siparisleri#/detail/<id>`, product cards | 13 |
| `robocombo-order-detail.html` | Robocombo (Ticimax, AngularJS) | `/Hesabim.aspx#/Siparislerim` with one order expanded | 30 |

`expected.json` is the ground truth: name, shop code, ordered quantity, pack size and pieces.

Rules these pages prove:

- **Özdisan** sells per piece. "REEL", "TUBE", "Cut Tape" are packaging, not multipliers.
- **Motorobit** names ending in "- 10 Adet" are packs of 10: a line of 10 such units is 100 pieces
  (checked against the product page price). The quantity is the `N Adet` line of each card.
- **Robocombo** quantity is the first `.sagDetay .hsbmSpan strong`; its label is empty, "Adet" or "ADET".
  The `strong` inside the name link is a shop stock code, not a part number. Every line satisfies
  quantity x unit price = line total (a confidence check, not the source of the quantity). Lines with
  class `iptal` are cancelled and must not be imported (none in this order). Names with "8'li", "16'lı"
  are one part with 8 positions or 16 pins, **not** packs.
