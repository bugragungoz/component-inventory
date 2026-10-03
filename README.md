<p align="center"><img src="docs/brand/social-tr.png" alt="Component Inventory: her parça, tam adediyle." width="720"></p>

# Component Inventory

Elektronik bileşenler için Windows'ta çalışan, verisi bilgisayarınızda kalan bir stok yönetimi uygulaması.
Elinizdeki parçaları, hangi kutularda durduklarını ve projelerinizin neye ihtiyaç duyduğunu tutar; Türk
elektronik mağazalarından verdiğiniz siparişler veya seçtiğiniz komponentler tarayıcı eklentisiyle uygulama içine doğrudan eklenebilir ya da uygun formatlarda içeri aktarılabilir.

[English](README.en.md) · [Değişiklikler](CHANGELOG.md) · [Katkı](CONTRIBUTING.md) · [İndir](https://github.com/bugragungoz/component-inventory/releases/latest)

![Envanter, koyu tema](docs/screenshots/inventory-dark.png)

## Özellikler

- **Akıcı arayüz** Sayfasız, 100.000 satırda bile akıcı bir tablo; Türkçe harfleri doğru eşleyen arama
  (`direnc` yazınca `DİRENÇ` eşleşmesi); her kategori ve alt kategori için simge; azalan stok işareti ve
  her değişikliğin stok geçmişi.
- **Kapsamlı içe aktarma yapısı** Mağaza siparişleri eklentiyle, Excel ve CSV dosyaları içe aktarma
  ekranıyla gelir. Her satırda adedin neden öyle olduğu görünür ("10 birim x 10'lu paket = 100 adet").
  İçe aktarma esnasında düzenleme yapabilme,içe aktarmayı daha sonra geri alabilme gibi özellikler mevcut.
- **Saklama yerleri** Daha gerçeğe yakın ve tutarlı bir görünüm için komponentleri masanızdaki kutu ve çekmecelerle aynı adlı yerlere koyabilirsiniz, böylece neyin nerede olduğunu takip etmek daha da kolaylaşır.
- **Projeler** Proje oluşturma ve komponentleri istenen projelere atayabilme,proje için eksikleri gösteren parça listesi ve yanında şema (PDF, görsel ya da
  KiCad).
- **Etiket ve dışa aktarma** Etiket oluşturma özelliği ile gerçek kutulamanıza uygun olacak şekilde kutularınıza yapıştırabileceğiniz etiketler hazırlama; Excel, CSV, JSON ve PDF olarak envanter listenizi dışa aktarabilme.
- **Yerel çalışma** Her şey bilgisayarınızdaki bir SQLite veritabanında durur. Her toplu işlemden önce
  yedek alınır. Sadece GitHub üzerinden internete  çıkar ve otomatik güncelleme kontrolü yapar, başka herhangi bir amaçla uygulama internet erişimini kullanmaz, istenirse internet erişimi kapatılabilir. Ayrıca eğer istenirse bilgisayarınızda kurulu Google Drive uygulamasının yedekleme klasörlerinin senkronize edebileceği bir klasöre yazma yapabilir, böylece hem sizin isteğinizle Drive hesabınıza otomatik yedekleme sağlanmış olur hem de telefonunuzdan Google Sheets üzerinden envanterinizi görebilirsiniz.

| İçe aktarma incelemesi | Proje parça listesi |
|---|---|
| ![İçe aktarma incelemesi](docs/screenshots/import-review-tr.png) | ![Proje parça listesi](docs/screenshots/projects-dark.png) |

## Kurulum

1. [Releases](https://github.com/bugragungoz/component-inventory/releases/latest) sayfasından **birini**
   indirin:
   - `Component.Inventory_<sürüm>_x64-setup.exe`: yalnızca sizin kullanıcınıza kurulur, yönetici izni
     istemez (önerilen).
   - `Component.Inventory_<sürüm>_x64_tr-TR.msi`: bilgisayarın tamamına kurulur, yönetici onayı ister.
2. Çalıştırın. Kurulum dosyaları henüz imzalı değil; Windows SmartScreen sorarsa **Ek bilgi** >
   **Yine de çalıştır**.
3. Eski bir sürüm kuruluysa aynı türden kurulumla üzerine kurun. İlk açılışta veritabanınızın bir
   kopyası `backups` klasörüne alınır, sonra yeni biçime taşınır.

Verilerin yeri: `%APPDATA%\com.bugragungoz.component-inventory` (Ayarlar'da da yazar).

### Tarayıcı eklentisi (Brave, Chrome, Edge)

1. Aynı sürüm sayfasından `component-inventory-extension-<sürüm>.zip` dosyasını indirip kalıcı bir
   klasöre açın (örneğin `Belgeler\component-inventory-extension`).
2. Adres çubuğuna `brave://extensions` (ya da `chrome://extensions`, `edge://extensions`) yazın,
   sağ üstten **Geliştirici modu**nu açın.
3. **Paketlenmemiş öğe yükle**'ye basıp açtığınız klasörü seçin.
4. Desteklenen bir mağazanın sipariş sayfasını açın. Sağ alttaki panel kaç satır bulduğunu yazar:
   **Uygulamaya aktar** uygulamada inceleme ekranını açar. Tarayıcı "uygulama açılsın mı?" diye
   sorarsa izin verin.

Uygulama açılmazsa panelde **Dosya olarak kaydet**'e basın ve inen `.cinv.json` dosyasını uygulamanın
İçe aktar ekranına bırakın. Yeni sürümler geldikçe zip'i aynı klasöre açıp eklenti kartındaki yenile düğmesine
basmanız yeter.

## Sonra eklenecekler

- **PDF içe aktarma:** yazdırılmış sipariş sayfalarından okuma şu an çalışmıyor olabilir, düzeltilecek. Sadece uzantı üzerinden geliştirdim bu sürümü, dosya import etme henüz test edilmedi.
- Mağaza ürün sayfasından kategori ve kılıf bilgisini otomatik doldurma.

## Çeviriler

Türkçe ve İngilizceyi kontrol ettim. Almanca, Rusça, Basitleştirilmiş Çince ve Arapça çevirmenliğini yapay zeka yaptı ve anadili olan
biri tarafından okunmadı; uygulamada "gözden geçirilmedi" diye görünürler. Ana dili olan kişiler ilgili çevirileri düzeltmek için bana ulaşabilir.

Düzeltmek ya da yeni dil eklemek için `src/locales/<dil>.json` dosyasını düzenleyin, `npm run
check:locales` ile denetleyin ve bir pull request açın. Ayrıntılar:
[CONTRIBUTING.md](CONTRIBUTING.md#translations).

## Geliştirme

Node.js 22.5+, Rust stable ve Windows'ta WebView2 gerekir.

```bash
npm ci                 # bağımlılıklar
npm run dev            # uygulama, canlı
npm run build          # kurulum dosyaları: target/release/bundle
npm run ext:build      # eklenti: extension/dist
npm run verify         # sürümler, diller, lint, tipler, birim testleri
cargo test --workspace # Rust çekirdeği
```

| Bölüm | Ne |
|---|---|
| `crates/inventory-core` | Tüm veri: SQLite şeması ve geçişleri, içe aktarma ve geri alma, yedekler, dışa aktarma. |
| `src-tauri` | Tauri kabuğu: pencereler, `component-inventory://` bağlantısı, zamanlayıcılar. |
| `src` | Arayüz: TypeScript, Preact, [Bugra tasarım sistemi](docs/design/bugra/README.md). |
| `packages/cinv` | Eklenti ile uygulamanın ortak biçimi ve mağaza paket kuralları. |
| `extension` | Manifest V3 tarayıcı eklentisi. |

## Gizlilik

Hesap yok, telemetri yok. Uygulama internete yalnızca yeni sürüm kontrolü için (kapatılabilir) çıkar. Envanter listeniz ise eğer siz ayarlardan 
açarsanız Google Drive klasörünüze kopya yazmak için kullanılabilir, varsayılan olarak kapalı. Eklenti sayfadan yalnızca ürün adlarını ve
adetleri okur, veriyi yalnızca sizin bilgisayarınızdaki uygulamaya gönderir.

## Lisans

[MIT](LICENSE)

---

Opus 5.5 ile kodlanmıştır.

Uygulama teması için kullandığım referans: https://github.com/cobanov (tv debloat reposu)

Henüz tam test etmedim, olası sorunlar için geri dönüş yapabilirsiniz. 