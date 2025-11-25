# Podręcznik Użytkownika - IntelHub 🕵️

Witamy w IntelHub. To rozszerzenie agreguje zaawansowane narzędzia białego wywiadu (OSINT) w jednym, wygodnym interfejsie, umożliwiając badaczom i analitykom szybkie i efektywne przeprowadzanie operacji.

---

## 🏠 Przegląd - Główny Interfejs
W lewym górnym rogu rozszerzenia znajdziesz przycisk **Refresh** do aktualizacji listy narzędzi i ustawień.
Poniżej znajduje się **Pasek Wyszukiwania** (Search Bar) do szybkiego lokalizowania konkretnych kategorii lub narzędzi.

![Menu Główne - Góra](images/1.png)

Po prawej stronie znajduje się **Pasek Przewijania**, służący do nawigacji między różnymi kategoriami. W prawym górnym rogu znajduje się przełącznik do zmiany **Motywu** (Theme).

![Menu Główne - Przewijanie](images/2.png)

---

## ⭐ Favorites - Zarządzanie Ulubionymi
Ta kategoria centralizuje narzędzia, które oznaczyłeś jako "Ulubione" z ogólnej puli, oraz pozwala na dodawanie własnych narzędzi i zarządzanie kategoriami.

![Ekran Ulubionych](images/3.png)

### Główne Akcje:
**New Category:** Twórz nowe foldery/kategorie, aby organizować swoje ulubione narzędzia.

![Utwórz Nową Kategorię](images/4.png)

**Add Custom Tool:** Dodaj zewnętrzne narzędzie (nieobecne w rozszerzeniu), wprowadzając Nazwę, URL i krótki opis. Możesz przypisać narzędzie do konkretnej kategorii przed zapisaniem.

![Dodaj Własne Narzędzie](images/5.png)

**Export/Import:** Eksportuj listę ulubionych i ustawienia jako plik kopii zapasowej lub importuj je, aby przenieść do innego użytkownika.

![Eksport i Import](images/6.png)

**Bieżące Zarządzanie:**
Tak wygląda lista narzędzi po dodaniu elementów.
Aby usunąć kategorię, kliknij ikonę kosza po prawej stronie. Aby usunąć narzędzie z ulubionych, kliknij ikonę Gwiazdki (Unstar).

![Lista Ulubionych](images/7.png)

---

## 🛠️ OSINT Tools - Repozytorium Narzędzi
Ta kategoria zawiera rdzeń rozszerzenia - kompleksową listę narzędzi wywiadowczych podzielonych na tematy. Lista jest automatycznie synchronizowana z repozytorium GitHub i aktualizowana co 24 godziny (lub po ręcznym odświeżeniu).

Kliknięcie tematu (Kategorii) otworzy listę należących do niego narzędzi:

![Kategorie i Narzędzia](images/8.png)

* Kliknięcie narzędzia otworzy je w nowej karcie.
* Kliknięcie ikony Gwiazdki obok nazwy narzędzia doda je do "Ulubionych".
* Najechaniem kursorem na narzędzie wyświetli krótki opis (Tooltip) jego funkcji.

![Opis Narzędzia](images/9.png)

---

## 🖼️ Reverse Image Search - Odwrócone Wyszukiwanie Obrazem
To narzędzie pozwala na przeprowadzenie odwróconego wyszukiwania obrazem w wielu wyszukiwarkach jednocześnie.

![Menu Wyszukiwania Obrazem](images/10.png)

**Opcje Wprowadzania:**
1.  **Upload:** Prześlij plik obrazu ze swojego komputera.
2.  **Paste:** Wklej obraz bezpośrednio ze Schowka.

*Przed wyszukiwaniem zaznacz pola wyboru wyszukiwarek, których chcesz użyć (Google, Yandex, Bing, TinEye itp.). Twój wybór zostanie zapisany na następny raz.*

---

## 📄 Metadata Analyzer - Analizator Metadanych
Narzędzie do wyodrębniania ukrytych informacji (Metadane/EXIF) z plików.

![Wybierz Typ Pliku](images/11.png)

Wybierz żądany typ pliku (Obraz, PDF lub dokument Office) i prześlij go. Raport z danymi pojawi się natychmiast na dole okna (przewiń w dół, aby zobaczyć wszystkie szczegóły).

![Wyniki Metadanych](images/12.png)

---

## 🔍 Google Dorks - Kreator Zapytań
Interfejs do łatwego budowania zaawansowanych zapytań wyszukiwania w Google.

![Kreator Dorks](images/13.png)

Wprowadź żądane parametry w różne pola (Wyszukiwanie w konkretnej witrynie, Typ pliku, Słowa kluczowe w Tytule/URL/Tekście).
Po zbudowaniu zapytania możesz kliknąć **Search on Google** w celu natychmiastowego wykonania lub zobaczyć strukturę zapytania w polu poniżej i skopiować ją.

![Kopiuj Zapytanie](images/14.png)

---

## ✈️ Telegram Tools - Narzędzia Telegram
Zestaw narzędzi do dochodzeń w Telegramie. Ta kategoria umożliwia wyszukiwanie numerów telefonów, zbieranie szczegółów o użytkownikach/grupach oraz analizę eksportów.

![Menu Narzędzi Telegram](images/15.png)

**User & Group Profiler:** Wprowadź nazwę użytkownika (lub link), aby przeprowadzić głębokie skanowanie i wyświetlić szczegóły użytkownika, zdjęcie profilowe, status oraz opcję pobrania numerycznego ID (**Fetch Numeric ID**).

![Wyniki Profilera Telegram](images/16.png)

---

## 🌐 Site, Link & Archive - Analiza Stron
Zbiór narzędzi do analizy bieżącej strony lub konkretnego adresu URL w celu wstępnego rozpoznania.

![Menu Analizy Strony](images/17.png)

**Dostępne Narzędzia:**
1.  **Website Fingerprint:** Przechwytuje odcisk palca strony (technologie, pliki cookie) w celu weryfikacji autentyczności.
2.  **WHOIS & DNS:** Sprawdza własność domeny i rekordy DNS.
3.  **Technology Detection:** Identyfikuje bazowy stos technologiczny.
4.  **Subdomain Finder:** Lokalizuje subdomeny.
5.  **Save Page Offline:** Zapisuje bieżącą stronę jako lokalny plik HTML dla dokumentacji.
6.  **Archive Search:** Przeszukuje historię witryny w różnych archiwach internetowych.

---

## 🆔 Social ID Extractor
Zaprojektowany do wyodrębniania **Numerycznego ID Użytkownika** z profili w mediach społecznościowych lub do nawigacji do profilu na podstawie istniejącego ID.

![Menu Ekstrakcji ID](images/18.png)

Przejdź do strony profilu (np. na Facebooku) i kliknij pierwszy przycisk, aby wyodrębnić ID.

![Wynik Ekstrakcji](images/19.png)

---

## 🔗 Link Analyzer - Analiza Linków
Zawiera narzędzia do sprawdzania bezpieczeństwa i pochodzenia linków.

![Menu Analizy Linków](images/20.png)

* **Unshorten URL:** Dekoduje skrócone linki (jak bit.ly), aby ujawnić oryginalny adres.
* **Scan for Viruses:** Sprawdza link w bazie danych VirusTotal.

---

## 📝 Text Profiler - Profilowanie Tekstu
Skanuje i wyodrębnia **Encje** z tekstu. System identyfikuje e-maile, portfele krypto, numery telefonów, nazwy użytkowników i więcej.

![Menu Profilera Tekstu](images/21.png)

Możesz analizować tekst poprzez **Paste** (Wklej), przesyłanie zewnętrznego pliku tekstowego lub skanowanie **Bieżącej Strony** w przeglądarce. Wyniki można wyeksportować do CSV.

---

## 📊 Investigation Graph - Graf Śledczy
Kliknięcie tej kategorii otwiera system wizualizacji.

![Przycisk Grafu](images/22.png)

Używając grafu, możesz stworzyć mapę dochodzenia, dodawać karty encji i łączyć je, aby wyraźnie zwizualizować obraz wywiadowczy.

![Interfejs Grafu](images/23.png)
