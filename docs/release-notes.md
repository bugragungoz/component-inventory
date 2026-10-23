# Component Inventory 1.0.0-beta.5

Hata düzeltmeleri ve güvenlik güncellemeleri. Verileriniz olduğu gibi kalır; önceki sürümün üzerine
kurun.

**Kurulum:** aşağıdan birini seçin.

- `Component.Inventory_1.0.0-beta.5_x64-setup.exe`: yalnızca sizin kullanıcınıza, yönetici izni istemez.
- `Component.Inventory_1.0.0-beta.5_x64_tr-TR.msi` / `_en-US.msi`: bilgisayarın tamamına, yönetici onayı ister.

**Tarayıcı eklentisi:** `component-inventory-extension-1.0.0-beta.5.zip` dosyasını sabit kalacağı bir
klasöre açın; Brave, Chrome ya da Edge'de eklentiler sayfasında **Geliştirici modu** > **Paketlenmemiş
öğe yükle** ile bu klasörü seçin. Önceki sürümün klasörü varsa içeriğini bununla değiştirip eklentiyi
yenilemeniz yeterli.

**Bu sürümde:**

- PDF içe aktarma için iki düzeltme. PDF'ler artık pdf.js'in eski tarayıcı sürümleriyle de uyumlu
  yapısıyla okunuyor; projelerdeki PDF şemalar bu yüzden bazı bilgisayarlarda boş kalıyordu. 45
  saniyede okunamayan bir PDF artık ekranda takılı kalmıyor; ne yapılacağını söyleyen bir mesaj çıkıyor.
- İçe aktarmada büyük/küçük harfi farklı bir kod ("ne555" ile NE555) artık aynı parçaya ekleniyor;
  önceden ikinci bir parça oluşuyordu.
- Yedek temizliği yedek klasörüne elle koyduğunuz `.db` dosyalarını silebiliyordu; artık yalnızca
  uygulamanın kendi yedeklerini siliyor.
- Küçük pencerelerde kenar çubuğundaki adlar, bildirimler ve inceleme tablosunun başlıkları düzeldi.
- Güvenlik: pdf.js, SheetJS (Excel okuma) ve DOMPurify güncellendi. Eski pdf.js, açılan bir PDF'in
  içine gizlenmiş bir betiği çalıştırabiliyordu.

**Bilinen:** PDF içe aktarmadaki sorun test ortamında görülmedi; hâlâ çalışmıyorsa çıkan mesajla
birlikte bildirin. Kurulum dosyaları imzasız; SmartScreen sorarsa **Ek bilgi** > **Yine de çalıştır**.

Tüm değişiklikler: [CHANGELOG.md](https://github.com/bugragungoz/component-inventory/blob/master/CHANGELOG.md) ·
English: [README.en.md](https://github.com/bugragungoz/component-inventory/blob/master/README.en.md)
