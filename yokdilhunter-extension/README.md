# YOKDILHUNTER Chrome Extension (Phase 2)

Bu uzantı, web sayfasında seçtiğiniz İngilizce kelimeleri sağ tıklayarak (veya klavye kısayoluyla) anında YOKDILHUNTER veritabanına kaydetmenizi sağlar.

## Özellikler
- **Sağ Tık Menüsü:** Seçili kelimeye sağ tıklayıp "YOKDILHUNTER'a Kaydet" seçeneğine tıklayın.
- **Klavye Kısayolu:** Kelimeyi seçtikten sonra `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`) tuşlarına basın.
- **Anında Bildirim:** Kayıt işlemi başarılı veya başarısız olduğunda sayfanın sağ alt köşesinde bildirim (toast) görünür.
- **Akıllı Çeviri:** Web uygulamasındaki aynı Google Translate, Wiktionary ve MyMemory API'lerini kullanarak kelimenin okunuşunu, tanımını, eş anlamlılarını ve Türkçe çevirilerini otomatik bulur.
- **Manuel Ekleme:** Eklenti ikonuna tıklayıp açılan pencereden hızlıca kelime ekleyebilirsiniz.

## Kurulum (Geliştirici Modu)
Bu eklenti kişisel kullanım içindir ve Chrome Web Mağazası'na yüklenmesi gerekmez (tamamen ücretsiz).

1. `config.js` dosyasını açın.
2. Web projenizdeki `.env` dosyasında bulunan bilgileri buraya girin:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Chrome'da `chrome://extensions/` adresine gidin.
4. Sağ üst köşedeki **"Geliştirici modu" (Developer mode)** anahtarını açın.
5. Sol üst köşedeki **"Paketlenmemiş öğe yükle" (Load unpacked)** butonuna tıklayın.
6. Bu eklentinin bulunduğu `yokdilhunter-extension` klasörünü seçin.

## Kullanım
1. Tarayıcının sağ üst köşesindeki "Yapboz" (Eklentiler) ikonuna tıklayın ve YOKDILHUNTER'ı sabitleyin.
2. YOKDILHUNTER ikonuna tıklayıp web uygulamasındaki hesabınızla **Giriş Yapın**.
3. Artık herhangi bir web sayfasında kelime seçip sağ tıklayarak kaydedebilirsiniz!
