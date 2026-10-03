# Devir notu: pazar yeri import + tarayıcı uzantısı

Bu dosya, planlama oturumunun sonucunu ve kaldığı yeri özetler. Yeni oturum yalnızca bunu ve repoyu
okuyarak devam edebilmelidir. Dal: `claude/handoff-import-extension` (taban: `claude/electronics-marketplace-import-xlx6aa`).

## 1. Kullanıcının isteği (öncelik sırasıyla)

Kullanıcı: elektrik-elektronik mühendisliği öğrencisi, Türkçe konuşuyor, mevcut sürümü günlük kullanıyor.

1. **Import doğru olmalı.** Yalnızca **bileşen adı/kodu, türü (kategori, İngilizce sabit taksonomi) ve adet** gerekli.
   Fiyat, stok numarası vb. önemsiz. Adet **kesinlikle** doğru olmalı.
2. **Mağazalar:** Özdisan, Direnç.net, Motorobit, Robocombo, Robiz, Robotistan (+ benzerleri).
   Özdisan sepet export'u veriyor, diğerlerinde export yok.
3. **Girişler:** (a) tarayıcı uzantısı, (b) sepet/sipariş sayfasını "PDF olarak yazdır" ile alıp yükleme,
   (c) Excel/CSV. PDF/OCR yolunda menü, "benzer ürünler", alt bilgi gibi **alakasız metin satır sayılmamalı**
   (kullanıcının OCR'da yaşadığı ana sorun bu).
4. **OCR:** ilk aşamada yalnızca Türkçe + İngilizce yeterli. "No cloud / no internet" kısıtı gevşetilebilir.
5. **Uzantı akışı:** sitede buton → uygulama açılır → import edilecekler **inceleme ekranında** görünür →
   kullanıcı onaylar. Tercihen **sipariş detayı** (gerçekten alınan adet) ve **ürün sayfası** (adet gir, tek tık) için;
   sepet ikincil.
6. **Arayüz:** mevcut düzen, renkler ve simgeler beğeniliyor. Sadece Anthropic/Claude temasına ve paletine
   uygun şekilde geliştirilecek. `frontend-design` eklentisi kurulacak (kullanıcı onay kartını onaylayacak).
   Önce önizleme/mockup göster.
7. **Tablo:** sayfalama **olmayacak**. Tüm veri aşağı kaydırılarak görülecek. Performans için sanal kaydırma
   (yalnızca görünen ~50 satır çizilir) kullanılabilir, kullanıcı farkı hissetmemeli.
8. **Proje bölümündeki sorunlar** düzeltilecek (aşağıda bulunan hatalar).
9. Bulunan **tüm hatalar** düzeltilecek ve ayrıca başka hata var mı diye ayrıntılı bakılacak.

## 2. Durum

### Yapıldı (bu daldaki commit'ler)
- `src/modules/cinv_format.js` (+ testler): uzantı ile uygulamanın ortak formatı (`cinv`, v1). Doğrulama, paket
  çarpanı (`qty × packSize`), aynı kodun adetlerini **toplama**, deep-link encode/decode.
- `src/modules/import.js`: `.cinv.json` dosyası mevcut inceleme ekranını açar; `openCinvPayload()` dışa açık
  (deep-link alıcısı bunu çağıracak). Onaylanmadan DB'ye yazılmaz.
- `extension/`: MV3 uzantısı. `bridge.js` (MAIN world, `window.dataLayer` snapshot), `content.js` (JSON-LD +
  dataLayer okur, kapalı shadow-DOM butonu, deep-link veya `.cinv.json` indirme), `extract_core.js` (saf
  fonksiyonlar), `sites.js` (yalnızca host listesi, `dom: null`), `build.mjs` (vite, IIFE paketleri →
  `extension/dist`). Kurulum: `extension/README.md`.
- Testler: `npm test` artık `src` ve `extension` altını çalıştırır (56 test geçiyor). Uygulama derlemesi
  (`npx vite build`) temiz. `extension/tests/e2e.mjs`: elle çalıştırılan Chromium uçtan uca denemesi.

### Yapılmadı / doğrulanmadı
- **Gerçek sitelere hiç erişilemedi** (önceki oturumun ağ politikası engelliyordu). `dataLayer`/JSON-LD'nin bu
  sitelerde gerçekten bulunduğu **varsayım**. Site-özel seçici yazılmadı, uydurulmadı.
- **Deep-link (`component-inventory://`) uygulamada tanımlı değil.** Tauri deep-link eklentisi, Rust tarafı,
  single-instance ile birlikte çalışması (`argv`'dan URL alma) ve Windows kayıt defteri kaydı gerekiyor.
  Şimdilik uzantıdaki `.json` butonu tek çalışan yol.
- Uzantı Brave'e yüklenerek denenmedi (yalnızca derlenmiş betikler Chromium'da elle enjekte edildi).
- Faz 1 hata düzeltmeleri, PDF/OCR, inceleme ekranı iyileştirmeleri, sanal kaydırma, tasarım yenilemesi: **başlanmadı**.

## 3. Bilinen hatalar (kodda doğrulandı, henüz düzeltilmedi)

Dosya/satır numaraları `211bf86` sürümüne göre yaklaşıktır.

| # | Hata | Yer |
|---|---|---|
| 1 | `parseLocaleNumber("1.000")` → **1**, `"1,000"` → 1, `"2.500"` → 2.5 (Node ile doğrulandı). Adet için binlik ayraç kuralı gerekli. | `src/app.js:1163` |
| 2 | Merge modunda `quantity = excluded.quantity`: mevcut stok **üzerine yazılıyor**, eklenmiyor | `src/app.js:319` |
| 3 | Aynı dosyada aynı kod iki satırdaysa ikincisi birincinin üzerine yazar (cinv yolunda çözüldü, eski yollarda değil) | `upsertComponents` |
| 4 | PDF'te "Ara Toplam/KDV/Kargo/Genel Toplam" ve sayfa başına tekrar eden başlık satırları parça sayılabilir | `import.js` `parsePDF` |
| 5 | Yanlış eşlemeler: `tedarikçi/supplier/vendor→manufacturer`, `seri no/lot no→mpn`, `url/link→datasheet_url` | `import_core.js` / `import.js` |
| 6 | Excel'de yalnızca ilk sayfa okunuyor (README çoklu sayfa diyor) | `import.js` `parseExcel` |
| 7 | `HEADER_MAP` iki dosyada ayrı ve birbirinden farklı | `import.js`, `import_core.js` |
| 8 | Satır başına 3 sorgu, transaction yok; yarıda hata olursa dosyanın yarısı yazılmış kalır. `tauri-plugin-sql` havuz kullandığı için JS'te güvenilir `BEGIN/COMMIT` yok → Rust'ta (`rusqlite` zaten bağımlılık) tek komutla toplu yazma | `upsertComponents` |
| 9 | Başarı mesajı her zaman "Warnings were number-format issues (auto-fixed)" diyor | `import.js` confirm handler |
| 10 | OCR hiç yok; taranmış/görüntü PDF'ler tamamen başarısız | `parsePDF` |
| 11 | **Replace modu tüm `components`'i siler ama `project_components`'i silmez** → yeni ID'lerle tüm proje BOM'ları sessizce boşalır | `app.js:281`, `projects.js` |
| 12 | Tek bileşen/toplu silmede `project_components` ve `stock_movements` yetim kalır | `app.js:262,276` |
| 13 | BOM'da her adet değişikliğinde şema dosyası baştan okunup yeniden çiziliyor; PDF zoom sıfırlanıyor | `projects.js` `renderBomTable` change handler |
| 14 | Her `wireKicadSchematicZoom` çağrısında `window`'a `mousemove/mouseup` dinleyicisi eklenir, hiç kaldırılmaz (sızıntı) | `projects.js:404-410` |
| 15 | "Eksik" (missing_qty) elle giriliyor; `max(0, gerekli − stok)` ile hesaplanmıyor | `projects.js` |
| 16 | Proje açıklaması/notları yalnızca Kaydet ile yazılıyor; başka projeye geçince kayboluyor | `projects.js` `saveProjectMeta` |
| 17 | `table.js:718` tüm satırları tek seferde `innerHTML` ile basıyor (binlerce kayıtta yavaş) | `table.js` |

## 4. Önerilen mimari

```
Girdi (uzantı | PDF/OCR | Excel/CSV) → cinv payload → normalleştir → zenginleştir (patched.db, desenler)
  → inceleme ekranı (düzenlenebilir, güven rengi, "stoğa ekle" varsayılan / "eşitle" seçenek)
  → tek transaction ile yaz (import_batch_id ile geri alınabilir)
```

- **Varsayılan davranış "stoğa ekle"**, "eşitle" ayrı seçenek (hata #2'nin çözümü).
- Distribütör (Özdisan) kodu genelde MPN'dir; e-ticaret sitelerinde kod mağaza SKU'sudur, gerçek bilgi ürün
  adındadır → adın içinden değer/paket/kategori çıkaran ayrıştırıcı gerekir.
- **Print-to-PDF:** Chrome PDF'inde metin katmanı vardır, çoğu zaman OCR gerekmez. Asıl çözüm **çapa tabanlı satır
  tespiti**: yalnızca adet deseni (`2 Adet`, `x3`, adet sütunu) taşıyan bloklar ürün satırıdır; fiyat/₺ deseni ek
  filtre olarak kullanılır (fiyat verisi saklanmaz); "Sepetim/Sipariş Detayı" ile "Ara Toplam" arası bölge kırpılır;
  PDF içindeki ürün linkleri okunur. OCR (`tesseract.js`, `tur+eng`, Web Worker, 300 DPI, ön işleme) yalnızca
  metin katmanı yoksa. Parça kodlarında `O/0 I/1 S/5 B/8` karışıklıkları `patched.db` ile doğrulanarak düzeltilir.
  Aritmetik kontrol (adet × birim fiyat ≈ satır toplamı) yalnızca **güven göstergesi** olarak kullanılabilir.
- **Önerilen yeni tablo (isteğe bağlı):** `supplier_parts(component_id, supplier, supplier_sku, product_url, ...)`.
- Kategori taksonomisi İngilizce sabit kalır (`src/modules/constants.js`, `attribute_schemas.js`).

## 5. Sonraki adımlar (önerilen sıra)

1. **Bu oturumda ağ/tarayıcı erişimi varsa:** her mağazanın herkese açık **ürün sayfasını** incele
   (JSON-LD `Product`, `dataLayer`, sepete ekle akışı). Giriş gerektiren sepet/sipariş sayfaları için kullanıcının
   Brave'inde DevTools ile bakılmalı. Bulguya göre `extension/src/sites.js` içindeki `dom` alanı doldurulur.
   Ürün sayfası için adet kutusu ("N adet ekle") uzantıya eklenecek; şu an yalnızca `qty: 1` gider.
2. **Faz 1:** hata #1–#9 ve #11–#16. Özellikle adet ayrıştırıcı için test yaz (`1.000`, `1,000`, `2.500`, `1.250,50`).
3. **Deep-link:** `tauri-plugin-deep-link`, `tauri.conf.json` şeması kaydı, `tauri_plugin_single_instance`
   callback'inde `argv` içinden `component-inventory://import?d=...` alıp frontend'e olay gönder →
   `decodeCinvDeepLink` → `openCinvPayload`. `capabilities/default.json` izinleri unutulmasın.
4. **PDF/OCR** (bölüm 4). Mağaza başına gerçek "yazdır → PDF" örnekleriyle test edilmeli; kullanıcıdan
   kişisel bilgisi silinmiş örnek iste veya kullanıcı bunları `test-fixtures/` altına koysun.
5. **İnceleme ekranı:** tüm satırlar (şu an yalnızca 8 satır önizleniyor), düzenlenebilir, satır seçimi, sütun eşleme.
6. **Sanal kaydırma** (sayfalama yok) ve **Claude temalı tasarım** (mockup → onay → uygulama).

## 6. Çalışma notları

- Çalıştır: `npm ci && npm test && npx vite build`. Uzantı: `npm run ext:build` → `brave://extensions` → Load unpacked → `extension/dist`.
- Uygulama Tauri v2 + düz JS. Rust derlemesi ve Windows kurulumu bu ortamlarda (Linux bulut) denenemez; Rust
  değişikliklerini dikkatli yaz ve kullanıcıya "derlenmedi" diye belirt.
- Kullanıcıya yalnızca doğrulananı "çalışıyor" de. Bu oturumda doğrulanan: birim testler, uygulama derlemesi,
  uzantının derlenmiş betiklerinin sahte sayfada Chromium'da çalışması. Doğrulanmayan: gerçek siteler, Brave'e
  yükleme, deep-link, Rust tarafı.
- Bash notu: `pkill -f`/`pgrep -f` ile komut satırında geçen kelimeyi (ör. "vitest") aramak kendi kabuğunu
  öldürebilir; PID ile öldür. `vitest --root /` verme, tüm dosya sistemini tarar.

## 7. Canlı site bulguları (Adım 1, 2026-09-29, bulut ortamından herkese açık ürün sayfaları)

| Site | Erişim | Bulgu |
|---|---|---|
| Özdisan | 200 | JSON-LD `Product`: `name`, `sku`, `mpn`, marka, kasa/besleme `additionalProperty`. `mpn` güvenilir. `dataLayer` yok. |
| Motorobit | 200 | T-Soft altyapısı. JSON-LD `Product` `@graph` içinde; `sku` mağaza kodu (`SNS.KVT.01.000020`), `mpn` yok. Gerçek bilgi ürün adında. Ürün sayfasında adet kutusu (`input[type=number]`) var. |
| Robotistan | 200 | T-Soft. JSON-LD `Product`, `sku` mağaza kodu (`17718`). |
| Robocombo | 200 | T-Soft'a benziyor; ürün sayfası **bulunamadı**, doğrulanmadı (`useSku:false` varsayım). |
| Robiz | 301 | Ana sayfada bağlantı bulunamadı; incelenmedi. |
| Direnç.net | 403 | Bulut ortamından engelli; kullanıcının tarayıcısında bakılmalı. |

Yapılan: `pickProductCode` (açık `mpn` her zaman güvenilir; `sku`/id yalnızca `useSku` ise), `sites.js`'te T-Soft
mağazaları için `useSku:false`, ürün sayfasında adet kutusu. Sepet/sipariş sayfaları (giriş gerekli) hâlâ görülmedi.

## 8. Durum güncellemesi (2. oturum)

Yapıldı (birim testli, `npm test` 95 geçiyor, `vite build` temiz): hata #1, #2, #3, #4, #5, #6, #7, #9, #11, #12, #13, #14, #15, #16;
#8 için taze yedek + hata mesajı (transaction değil, Rust'ta toplu yazma yapılmadı); sanal kaydırma (>200 satır);
inceleme ekranı (tüm satırlar, düzenlenebilir adet, satır dışlama); deep-link (Rust + JS, **derlenmedi**).

Hâlâ yok: #10 OCR / çapa tabanlı PDF, sepet/sipariş sayfası seçicileri, Claude teması + mockup, sütun eşleme UI'ı,
`supplier_parts` tablosu, Rust'ta atomik toplu yazma.
Doğrulanmadı (Windows'ta denenmeli): MSI derlemesi, deep-link kaydı/açılışı, sanal kaydırma davranışı, inceleme ekranı, BOM düzenlemeleri.

## 9. Durum güncellemesi (3. oturum)

- **Edit ve Ekle çalışmıyordu:** `modals.js` içinde `existingAttrs` tanımsızdı (düzenle penceresi hiç açılmıyordu) ve
  `collectAttributeValues` içe aktarılmamıştı (kaydet sessizce düşüyordu). Aynı türden 5 hata daha bulundu
  (`getSchemaForCategory`, `renderAttributeFields`, `invoke` in table.js, `escapeHtml`, `normaliseSimple`).
  `npm run lint` (ESLint `no-undef`) artık `build-msi.ps1` içinde çalışıyor.
- **UI testleri:** Tauri'yi taklit eden Chromium düzeneği (SQLite `node:sqlite` ile gerçek) repoda yok, oturumda
  kuruldu: ekle/düzenle/sil, içe aktarma, sanal kaydırma, projeler, arama, tüm pencereler tıklanarak denendi.
  Gerekirse yeniden kurulabilir: `window.__TAURI_INTERNALS__.invoke` taklidi + `plugin:sql|load/execute/select`.
- **Sipariş sayfaları (uzantı):** `extension/src/dom_extractors.js`. Özdisan `/siparis-detay/` ve Motorobit
  `/uye-siparisleri#/detail/` kayıtlı gerçek sayfalarla doğrulandı. Motorobit "N Adet" satırı = birim sayısı;
  "- 10 Adet" paketli üründe toplam = birim x 10 (fiyattan doğrulandı). Özdisan'da paket çarpanı kullanılmaz.
  Robocombo `Hesabim.aspx#/Siparislerim` kayıtlı sayfasında satırlar kapalıydı (ng-repeat), seçici yazılamadı.
- Bugra teması uygulandı (`style.css` jetonlar + "BUGRA THEME LAYER"), README yenilendi.
